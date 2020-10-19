import * as sourcegraph from 'sourcegraph'
import { combineLatest, EMPTY, from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import { searchIssues, IssueType, searchComponents, Severity, listBranches } from './api'

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

interface Configuration {
    'sonarqube.showIssuesOnCodeViews'?: boolean
    'sonarqube.instanceUrl'?: string
    'sonarqube.corsAnywhereUrl'?: string
    'sonarqube.organizationPattern'?: string
    'sonarqube.organizationKeyTemplate'?: string
    'sonarqube.projectKeyTemplate'?: string
}

const getConfig = (): Configuration => sourcegraph.configuration.get<Configuration>().value

export function activate(context: sourcegraph.ExtensionContext): void {
    const config = getConfig()
    const sonarqubeUrl = new URL(config['sonarqube.instanceUrl'] || 'https://sonarcloud.io/')
    const corsAnyWhereUrl = new URL(config['sonarqube.corsAnywhereUrl'] || 'https://cors-anywhere.herokuapp.com')
    const sonarqubeApiUrl = new URL(
        `${corsAnyWhereUrl.href.replace(/\/$/, '')}/${sonarqubeUrl.href.replace(/\/$/, '')}/`
    )
    context.subscriptions.add(
        combineLatest([
            from(sourcegraph.app.activeWindowChanges).pipe(
                switchMap(activeWindow => activeWindow?.activeViewComponentChanges || EMPTY),
                filter((viewer): viewer is sourcegraph.CodeEditor => !!viewer && viewer.type === 'CodeEditor')
            ),
            from(sourcegraph.configuration),
        ])
            .pipe(
                switchMap(async ([editor]) => {
                    try {
                        const config = getConfig()
                        if (config['sonarqube.showIssuesOnCodeViews'] === false) {
                            return { editor, issues: [] }
                        }

                        const uri = new URL(editor.document.uri)
                        const repoName = decodeURIComponent(uri.hostname + uri.pathname)
                        const commitID = decodeURIComponent(uri.search.slice(1))
                        const filePath = decodeURIComponent(uri.hash.slice(1))

                        const repositoryNamePattern = new RegExp(
                            config['sonarqube.organizationPattern'] || '(?:^|/)([^/]+)/([^/]+)$'
                        )
                        const repositoryNameMatch = repoName.match(repositoryNamePattern)
                        if (!repositoryNameMatch) {
                            throw new Error(
                                `repositoryNamePattern ${repositoryNamePattern.toString()} did not match repository name ${repoName}`
                            )
                        }
                        const organizationKeyTemplate = config['sonarqube.organizationKeyTemplate'] ?? '$1'
                        const organization = organizationKeyTemplate.replace(
                            /\$(\d)/g,
                            (substring, number: string) => repositoryNameMatch[+number]
                        )
                        const projectKeyTemplate = config['sonarqube.projectKeyTemplate'] ?? '$1_$2'
                        const project = projectKeyTemplate.replace(
                            /\$(\d)/g,
                            (substring, number: string) => repositoryNameMatch[+number]
                        )
                        console.log('Mapped repository name to Sonarqube according to templates', {
                            organization,
                            project,
                        })

                        // For some reason searching for the whole file path doesn't work.
                        // As soon as the query contains a slash, no results are returned.
                        const fileName = filePath.split('/').pop()!
                        const components = await searchComponents({ query: fileName, organization, sonarqubeApiUrl })
                        const component = components.find(
                            component => component.key.endsWith(filePath) && component.project === project
                        )
                        if (!component) {
                            throw new Error(
                                `Could not find Sonarqube component for this file in Sonarqube project "${project}"`
                            )
                        }
                        const branches = await listBranches({ project: component.project, sonarqubeApiUrl })
                        const branch = branches.find(branch => branch.commit.sha === commitID)
                        if (!branch) {
                            console.warn(
                                `No Sonarqube branch found for commit ID ${commitID}, falling back to default branch`
                            )
                        }
                        const issues = await searchIssues({
                            sonarqubeApiUrl,
                            componentKeys: [component.key],
                            branch: branch?.name,
                        })
                        return { editor, issues }
                    } catch (error) {
                        console.error(error)
                        sourcegraph.internal.updateContext({ 'sonarqube.errorMessage': error?.message })
                        return { editor, issues: [] }
                    }
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
                            backgroundColor: 'rgba(var(--oc-red-7-rgb), 0.1)',
                            border: '1px solid rgba(var(--oc-red-7-rgb), 0.9)',
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

    context.subscriptions.add(
        sourcegraph.commands.registerCommand('sonarqube.toggleIssuesOnCodeViews', async () => {
            const config = sourcegraph.configuration.get<Configuration>()
            const showIssuesOnCodeViews = config.value['sonarqube.showIssuesOnCodeViews'] !== false
            await config.update('sonarqube.showIssuesOnCodeViews', !showIssuesOnCodeViews)
        })
    )
}

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
