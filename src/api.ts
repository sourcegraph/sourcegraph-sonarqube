interface ApiOptions {
    sonarqubeApiUrl: URL
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

interface Issue {
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

async function jsonResponse(response: Response): Promise<any> {
    if (!response.ok) {
        throw new Error(response.statusText)
    }
    const result = await response.json()
    return result
}

export async function searchComponents(
    options: ApiOptions & { query: string; organization: string }
): Promise<Component[]> {
    const url = new URL('api/components/search', options.sonarqubeApiUrl)
    url.searchParams.set('organization', options.organization)
    url.searchParams.set('qualifiers', 'FIL,UTS')
    url.searchParams.set('q', options.query)
    const result = await jsonResponse(await fetch(url.href))
    return result.components
}

export async function fetchIssues(options: FetchIssuesOptions): Promise<Issue[]> {
    const url = new URL('api/issues/search', options.sonarqubeApiUrl)
    // Comma-separated list of component keys. Retrieve issues associated to a specific list of components (and all
    // its descendants). A component can be a project, directory or file.
    url.searchParams.set('componentKeys', options.componentKeys.join(','))
    if (options.branch) {
        url.searchParams.set('branch', options.branch)
    }
    const result = await jsonResponse(await fetch(url.href))
    return result.issues
}
