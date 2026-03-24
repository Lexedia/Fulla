use crate::AppState;
use crate::handlers::ApiError;
use crate::models::{SearchPackage, SearchResult};
use axum::{Json, extract::State};
use std::collections::HashMap;
use std::sync::Arc;

fn escape_filter_value(input: &str) -> String {
    input.replace('\\', "\\\\").replace('"', "\\\"")
}

pub async fn search_packages(
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<SearchResult>, ApiError> {
    let q = params.get("q").cloned().unwrap_or_default();
    let page = params
        .get("page")
        .and_then(|p| p.parse::<usize>().ok())
        .unwrap_or(1);
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<usize>().ok())
        .unwrap_or(10);
    let offset = (page - 1) * limit;

    if let Some(search) = &state.search {
        let query_string = if q.is_empty() { "*" } else { &q };

        let mut filter_string = if let Some(owner) = params.get("owner") {
            format!("owner_username = \"{}\"", escape_filter_value(owner))
        } else {
            String::new()
        };

        if let Some(platforms_str) = params.get("platforms") {
            let platforms: Vec<&str> = platforms_str.split(',').filter(|s| !s.is_empty()).collect();
            if !platforms.is_empty() {
                let platform_filters: Vec<String> = platforms
                    .iter()
                    .map(|p| format!("platforms = \"{}\"", escape_filter_value(p)))
                    .collect();
                let p_filter = format!("({})", platform_filters.join(" OR "));
                if filter_string.is_empty() {
                    filter_string = p_filter;
                } else {
                    filter_string = format!("{} AND {}", filter_string, p_filter);
                }
            }
        }

        let sort_str = params.get("sort").and_then(|sort| match sort.as_str() {
            "Pub Points" => Some("score:desc"),
            "Last Updated" => Some("updated_at:desc"),
            "Popularity" => Some("score:desc"),
            _ => None,
        });

        let index = search.index("packages");
        let mut search_req = index.search();
        search_req.with_query(query_string);
        search_req.with_offset(offset);
        search_req.with_limit(limit);

        if !filter_string.is_empty() {
            search_req.with_filter(&filter_string);
        }

        let sorts;
        if let Some(s) = sort_str {
            sorts = [s];
            search_req.with_sort(&sorts);
        }

        let results = search_req
            .execute::<serde_json::Value>()
            .await
            .map_err(|e| ApiError::Internal(format!("Search failed: {}", e)))?;

        let packages = results
            .hits
            .into_iter()
            .map(|hit| {
                let result = hit.result;
                SearchPackage {
                    package: result["name"].as_str().unwrap_or("unknown").to_string(),
                    version: result["version"].as_str().unwrap_or("0.0.0").to_string(),
                    description: result["description"].as_str().map(|s| s.to_string()),
                    score: result.get("score").and_then(|s| s.as_i64()),
                    updated_at: result
                        .get("updated_at")
                        .and_then(|s| s.as_str())
                        .and_then(|s| s.parse().ok())
                        .unwrap_or_else(chrono::Utc::now),
                    is_discontinued: result
                        .get("is_discontinued")
                        .and_then(|s| s.as_bool())
                        .unwrap_or_default(),
                    owner_username: result
                        .get("owner_username")
                        .and_then(|s| s.as_str())
                        .map(|s| s.to_string()),
                    owner_avatar: result
                        .get("owner_avatar")
                        .and_then(|s| s.as_str())
                        .map(|s| s.to_string()),
                    like_count: result
                        .get("like_count")
                        .and_then(|s| s.as_i64())
                        .unwrap_or_default(),
                    download_count: result
                        .get("download_count")
                        .and_then(|s| s.as_i64())
                        .unwrap_or_default(),
                    platforms: result
                        .get("platforms")
                        .and_then(|p| p.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default(),
                }
            })
            .collect();

        Ok(Json(SearchResult {
            packages,
            total_hits: results.estimated_total_hits.unwrap_or_default() as i64,
        }))
    } else {
        let pattern = format!("%{}%", q);

        let sort_col = params
            .get("sort")
            .map(|s| match s.as_str() {
                "Last Updated" => "p.updated_at",
                _ => "ar.score",
            })
            .unwrap_or("ar.score");

        let owner: Option<String> = params.get("owner").cloned();

        let sql = format!(
            r#"
            SELECT
                p.name,
                pv.version,
                pv.pubspec->>'description' AS description,
                ar.score,
                p.updated_at,
                p.is_discontinued,
                u.username AS owner_username,
                u.avatar_url AS owner_avatar,
                (SELECT COUNT(*) FROM downloads d INNER JOIN package_versions pv2 ON d.package_version_id = pv2.id WHERE pv2.package_id = p.id) AS download_count,
                (SELECT COUNT(*) FROM package_likes WHERE package_id = p.id) AS like_count
            FROM packages p
            CROSS JOIN LATERAL (
                SELECT version, pubspec, id
                FROM package_versions
                WHERE package_id = p.id
                ORDER BY created_at DESC
                LIMIT 1
            ) pv
            LEFT JOIN analysis_results ar ON ar.package_version_id = pv.id
            LEFT JOIN users u ON u.id = p.owner_id
            WHERE (p.name ILIKE $1 OR pv.pubspec->>'description' ILIKE $1)
              AND ($4::text IS NULL OR u.username = $4)
            ORDER BY {sort_col} DESC NULLS LAST, p.updated_at DESC
            LIMIT $2 OFFSET $3
            "#
        );

        let count_sql = r#"
            SELECT COUNT(*)
            FROM packages p
            CROSS JOIN LATERAL (
                SELECT pubspec
                FROM package_versions
                WHERE package_id = p.id
                ORDER BY created_at DESC
                LIMIT 1
            ) pv
            LEFT JOIN users u ON u.id = p.owner_id
            WHERE (p.name ILIKE $1 OR pv.pubspec->>'description' ILIKE $1)
              AND ($2::text IS NULL OR u.username = $2)
            "#;

        let rows: Vec<(
            String,
            String,
            Option<String>,
            Option<i32>,
            chrono::DateTime<chrono::Utc>,
            bool,
            Option<String>,
            Option<String>,
            i64,
            i64,
        )> = sqlx::query_as(&sql)
            .bind(&pattern)
            .bind(limit as i64)
            .bind(offset as i64)
            .bind(&owner)
            .fetch_all(&state.db)
            .await
            .map_err(|e| ApiError::Internal(format!("Search query failed: {}", e)))?;

        let total_hits: i64 = sqlx::query_scalar(count_sql)
            .bind(&pattern)
            .bind(&owner)
            .fetch_one(&state.db)
            .await
            .unwrap_or_default();

        let packages = rows
            .into_iter()
            .map(
                |(
                    name,
                    version,
                    description,
                    score,
                    updated_at,
                    is_discontinued,
                    owner_username,
                    owner_avatar,
                    download_count,
                    like_count,
                )| {
                    SearchPackage {
                        package: name,
                        version,
                        description,
                        score: score.map(|s| s as i64),
                        download_count,
                        like_count,
                        updated_at,
                        is_discontinued,
                        owner_username,
                        owner_avatar,
                        platforms: vec![],
                    }
                },
            )
            .collect();

        Ok(Json(SearchResult {
            packages,
            total_hits,
        }))
    }
}
