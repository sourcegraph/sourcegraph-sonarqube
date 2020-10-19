import * as sourcegraph from 'sourcegraph'
import { EMPTY, from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import { fetchIssues, IssueType, searchComponents, Severity } from './api'

const decorationKey = sourcegraph.app.createDecorationType()

const typeIcons: Record<IssueType, string> = {
    BUG: '🐞',
    CODE_SMELL: '☢️',
    VULNERABILITY: '🔓',
}

const severityIcons: Record<Severity, string> = {
    BLOCKER: '⛔️',
    CRITICAL: '❗️',
    MAJOR: '⬆️',
    MINOR: '⬇️',
}

export function activate(context: sourcegraph.ExtensionContext): void {
    const sonarqubeUrl = new URL('https://sonarcloud.io/')
    const sonarqubeApiUrl = new URL(`https://cors-anywhere.herokuapp.com/${sonarqubeUrl.href}`)
    context.subscriptions.add(
        from(sourcegraph.app.activeWindowChanges)
            .pipe(
                switchMap(activeWindow => (activeWindow && activeWindow.activeViewComponentChanges) || EMPTY),
                filter((viewer): viewer is sourcegraph.CodeEditor => !!viewer && viewer.type === 'CodeEditor'),
                switchMap(async editor => {
                    const uri = new URL(editor.document.uri)
                    const repoName = decodeURIComponent(uri.hostname + uri.pathname)
                    // const revision = decodeURIComponent(uri.search.slice(1))
                    const filePath = decodeURIComponent(uri.hash.slice(1))
                    const fileName = filePath.split('/').pop()!
                    const repoNameParts = repoName.split('/')
                    if (repoNameParts.length === 3) {
                        repoNameParts.shift()
                    } else if (repoNameParts.length !== 2) {
                        throw new Error('Repository name not in org/name format')
                    }
                    const [organization, repo] = repoNameParts
                    // For some reason searching for the whole file path doesn't work.
                    // As soon as the query contains a slash, no results are returned.
                    const components = await searchComponents({ query: fileName, organization, sonarqubeApiUrl })
                    const component = components.find(
                        component => component.key.endsWith(filePath) && component.project.includes(repo)
                    )
                    if (!component) {
                        throw new Error('Could not find Sonarqube component')
                    }
                    const issues = await fetchIssues({
                        sonarqubeApiUrl,
                        componentKeys: [component.key],
                    })
                    return { editor, issues }
                })
            )
            .subscribe(({ editor, issues }) => {
                editor.setDecorations(
                    decorationKey,
                    issues.map(issue => {
                        const { effort, type, severity, message, key, project } = issue
                        const { startLine, endLine, startOffset, endOffset } = issue.textRange
                        const dateString = new Date(issue.creationDate).toLocaleDateString()
                        const tagsString = issue.tags.map(tag => `🏷 ${tag}`).join(' ')
                        const typeString = type.replace(/_/g, ' ')
                        const severityIcon = severityIcons[severity]
                        const typeIcon = typeIcons[type]
                        return {
                            range: new sourcegraph.Range(startLine - 1, startOffset, endLine - 1, endOffset),
                            border: '1px solid var(--danger)',
                            after: {
                                color: 'var(--danger)',
                                contentText: ` ${typeIcon} ${typeString}: ${message} ${severityIcon} ${severity} ⏱ ${effort} effort 🗓 created ${dateString} ${tagsString} `,
                                linkURL: new URL(`/project/issues?id=${project}&open=${key}`, sonarqubeUrl).href,
                            },
                        }
                    })
                )
            })
    )
}

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
