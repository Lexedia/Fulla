use goose::prelude::*;

use serde_json::json;

async fn load_test_auth(user: &mut GooseUser) -> TransactionResult {
    let username = format!("stress_{}", uuid::Uuid::new_v4().simple());
    let payload = json!({
        "username": username,
        "password": "ValidPassword123!"
    });

    let _request = user.post_json("/api/register", &payload).await?;

    let _login_req = user.post_json("/api/login", &payload).await?;

    Ok(())
}

async fn load_test_read(user: &mut GooseUser) -> TransactionResult {
    let _ = user.get("/api/search?q=a").await?;
    Ok(())
}

async fn load_test_upload(user: &mut GooseUser) -> TransactionResult {
    let xyz = "--xyz\r\nContent-Disposition: form-data; name=\"file\"; filename=\"dummy.tar.gz\"\r\nContent-Type: application/gzip\r\n\r\nhi\r\n--xyz--\r\n";
    let request_builder = user
        .client
        .post(format!("{}/api/upload", user.base_url))
        .header("Content-Type", "multipart/form-data; boundary=xyz")
        .body(xyz);

    let goose_req = GooseRequest::builder()
        .set_request_builder(request_builder)
        .build();

    let _response = user.request(goose_req).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), GooseError> {
    GooseAttack::initialize()?
        .register_scenario(
            scenario!("Auth Load")
                .register_transaction(transaction!(load_test_auth).set_weight(1)?),
        )
        .register_scenario(
            scenario!("Read API Load")
                .register_transaction(transaction!(load_test_read).set_weight(9)?),
        )
        .register_scenario(
            scenario!("Upload Load")
                .register_transaction(transaction!(load_test_upload).set_weight(2)?),
        )
        .execute()
        .await?;

    Ok(())
}
