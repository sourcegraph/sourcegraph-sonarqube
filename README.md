# [Sonarqube](https://www.sonarqube.org/) Sourcegraph extension

Show Sonarqube issues when browsing files on Sourcegraph.

<p>
<picture>
<source srcset="https://raw.githubusercontent.com/sourcegraph/sourcegraph-sonarqube/main/images/screenshot_dark.png" media="(prefers-color-scheme: dark)">
<source srcset="https://raw.githubusercontent.com/sourcegraph/sourcegraph-sonarqube/main/images/screenshot_light.png" media="(prefers-color-scheme: light)">
<img src="https://raw.githubusercontent.com/sourcegraph/sourcegraph-sonarqube/main/images/screenshot_light.png" alt="Screenshot">
</picture>
</p>

➡️ Try it out on [github.com/apache/struts](https://sourcegraph.com/github.com/apache/struts/-/blob/apps/rest-showcase/src/main/java/org/demo/rest/example/OrdersController.java)

You can toggle decorations with the Sonarqube button in the action toolbar.
Each decoration links to the issue on Sonarqube.

## Configuration

The extension can be configured through JSON in user, organization or global settings.

```jsonc
{
  // Configure the extension to use a private Sonarqube instance.
  // By default, Sonarcloud is used.
  "sonarqube.instanceUrl": "https://sonarcloud.io/",
  // An API token to the Sonarqube instance, if needed.
  "sonarqube.apiToken": "...",

  // The Sonarqube extension needs to map the repository on Sourcegraph to a project inside an organization on
  // Sonarqube. The default settings work for most projects on Sonarcloud, but if you have a custom setup, you
  // can configure the following settings.

  // This regular expression is matched on the repository name. The values from the capture groups are
  // available in the templates below.
  "sonarqube.repositoryNamePattern": "(?:^|/)([^/]+)/([^/]+)$",
  // This template is used to form the Sonarqube organization key.
  // By default, the second-last part of the repository name (first capture group above) is used as-is.
  // E.g. "apache" from "github.com/apache/struts".
  "sonarqube.organizationKeyTemplate": "$1",
  // This template is used to form the Sonarqube project key.
  // By default, the second-last and last part of the repository name (first and second capture groups above)
  // are joined by an underscore.
  // E.g. "apache_struts" from "github.com/apache/struts".
  "sonarqube.projectKeyTemplate": "$1_$2",

  // CORS headers are necessary for the extension to fetch data, but Sonarqube does not send them by default.
  // Here you can customize the URL to an HTTP proxy that adds CORS headers.
  // By default Sourcegraph's CORS proxy is used.
  "sonarqube.corsAnywhereUrl": "https://cors-anywhere.herokuapp.com"
}
```

## Limitations

The current commit viewed on Sourcegraph may not be analyzed on Sonarqube.
If that is the case, the extension will fallback to the latest analysis available on Sonarqube on the default branch.
This may result in decorations being off in some files if those files differ between the commit being viewed and the one analyzed on Sonarqube.

---

SONARQUBE is a trademark belonging to SonarSource SA.
