export interface ApiOptions {
    sonarqubeApiUrl: URL

    /** API authentication token */
    apiToken?: string
}

interface FetchIssuesOptions extends ApiOptions {
    componentKeys: string[]
    branch?: string
}

type Qualifier = 'FIL' | 'UTS' | 'DIR' | 'TRK' | 'BRC'

interface Component {
    organization: string
    key: string
    name: string
    qualifier: Qualifier
    language: string
    project: string
}

export type IssueType = 'BUG' | 'VULNERABILITY' | 'CODE_SMELL'

export type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER'

export interface Issue {
    key: string
    rule: string
    severity: Severity
    component: string
    project: string
    line: number
    hash: string
    textRange: {
        startLine: number
        endLine: number
        startOffset: number
        endOffset: number
    }
    flows: []
    status: string
    message: string
    effort: string
    debt: string
    tags: string[]
    creationDate: string
    updateDate: string
    type: IssueType
    organization: string
    fromHotspot: false
}

async function fetchApi(path: string, searchParameters: URLSearchParams, options: ApiOptions): Promise<any> {
    const url = new URL(path, options.sonarqubeApiUrl)
    url.search = searchParameters.toString()
    const headers = new Headers()
    if (options.apiToken) {
        headers.set('Authorization', 'Basic ' + btoa(options.apiToken + ':'))
    }
    const response = await fetch(url.href, { headers })
    if (!response.ok) {
        if (response.headers.get('Content-Type')?.includes('json')) {
            const { errors } = (await response.json()) as { errors: { msg: string }[] }
            if (errors.length === 1) {
                throw new Error(errors[0].msg)
            }
            throw new AggregateError(
                errors.map(error => new Error(error.msg)),
                errors.map(error => error.msg).join('\n')
            )
        }
        throw new Error(response.statusText)
    }
    const result = await response.json()
    return result
}

export async function searchComponents(
    options: ApiOptions & { query: string; organization: string, component: string }
): Promise<Component[]> {
    const searchParameters = new URLSearchParams()
    searchParameters.set('organization', options.organization)
    searchParameters.set('component', options.component)
    searchParameters.set('qualifiers', 'FIL,UTS')
    searchParameters.set('q', options.query)
    const result = await fetchApi('api/components/tree', searchParameters, options)
    return result.components
}

export async function searchIssues(options: FetchIssuesOptions): Promise<Issue[]> {
    const searchParameters = new URLSearchParams()
    // Comma-separated list of component keys. Retrieve issues associated to a specific list of components (and all
    // its descendants). A component can be a project, directory or file.
    searchParameters.set('componentKeys', options.componentKeys.join(','))
    if (options.branch) {
        searchParameters.set('branch', options.branch)
    }
    const result = await fetchApi('api/issues/search', searchParameters, options)
    return result.issues
}

export interface Branch {
    name: string
    isMain: boolean
    /** Long-lived or short-lived */
    type: 'LONG' | 'SHORT'
    status: {
        qualityGateStatus: 'ERROR' | 'OK'
        bugs?: number
        vulnerabilities?: number
        codeSmells?: number
    }
    analysisDate: string
    commit?: {
        sha: string
        author: {
            name: string
            login: string
            avatar: string
        }
        date: string
        message: string
    }
}

export async function listBranches(options: { project: string } & ApiOptions): Promise<Branch[]> {
    const searchParameters = new URLSearchParams()
    searchParameters.set('project', options.project)
    const result = await fetchApi('api/project_branches/list', searchParameters, options)
    return result.branches
}
