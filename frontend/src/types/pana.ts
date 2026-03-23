export interface PanaReport {
    timestamp: string;
    panaVersion: string;
    sdkVersion: string;
    packageName: string;
    packageVersion: string;
    pubspec: any;
    platform: {
        worksEverywhere: boolean;
        reason: string;
    };
    licenses: License[];
    health: {
        analyzeError: boolean;
        analyzeWarning: boolean;
        analyzeHint: boolean;
        format: boolean;
    };
    maintenance: {
        missingChangelog: boolean;
        missingExample: boolean;
        missingReadme: boolean;
        missingAnalysisOptions: boolean;
        oldAnalysisOptions: boolean;
        strongModeEnabled: boolean;
        isExperimental: boolean;
        isPreRelease: boolean;
    };
    suggestions: Suggestion[];
    report: Report;
    runtimeInfo: {
        panaVersion: string;
        sdkVersion: string;
    };
    scores: {
        maxPoints: number;
        grantedPoints: number;
    };
    tags: string[];
}

export interface License {
    path: string;
    spdxIdentifier: string;
}

export interface Suggestion {
    code: string;
    level: string;
    title: string;
    description: string;
    file: string;
    score: number;
}

export interface Report {
    sections: ReportSection[];
}

export interface ReportSection {
    id: string;
    title: string;
    grantedPoints: number;
    maxPoints: number;
    status: 'passed' | 'partial' | 'failed';
    summary: string;
}
