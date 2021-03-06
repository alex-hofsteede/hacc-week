/* global fetch, Request, Headers, chrome, localStorage */

const API = 'http://127.0.0.1:5000/'
const GITHUB_TOKEN_KEY = 'x-github-token'

const storage = chrome.storage.sync || chrome.storage.local

let githubToken

const pageType = (uri) => {
    const repoURI = uri.split('/')
    return repoURI.length > 3 ? repoURI[2] : "unknown";  // usually "blob" or "tree"
}

const checkStatus = (response) => {
    if (response.status >= 200 && response.status < 300) {
        return response
    }

    throw Error(`GitHub returned a bad status: ${response.status}`)
}

const parseJSON = (response) => {
    if (response) {
        return response.json()
    }

    throw Error('Could not parse JSON')
}

const getAPIData = (uri, callback) => {
    const headerObj = {
        'User-Agent': 'harshjv/github-repo-size'
    }

    const token = localStorage.getItem(GITHUB_TOKEN_KEY) || githubToken

    if (token) {
        headerObj['Authorization'] = 'token ' + token
    }

    const request = new Request(API + uri, {
        headers: new Headers(headerObj)
    })

    fetch(request)
        .then(checkStatus)
        .then(parseJSON)
        .then(callback)
        .catch(e => console.error(e))
}

const getFileName = (text) => text.trim().split('/')[0]

const makeSparkline = (values) => {
    const xmlns = "http://www.w3.org/2000/svg";
    const width = 50;
    const height = 14;

    let sparkline = document.createElementNS(xmlns, "svg");
    sparkline.setAttribute('class', 'sparkline');
    sparkline.setAttribute('width', width);
    sparkline.setAttribute('height', height);
    sparkline.setAttribute('version', '1.1');

    let path = document.createElementNS(xmlns, "path")
    sparkline.appendChild(path);

    var limits = [Math.max(0, Math.min.apply(this, values) - 1), Math.max.apply(this, values) + 1];
    var scale = Math.pow(10, Math.floor(Math.log10(limits[1] - limits[0])));
    var domain = [Math.floor(limits[0] / scale) * scale, Math.ceil(limits[1] / scale) * scale];
    var range = [height-1, 0];
    var step = width / Math.max(values.length - 1, 1)
    pathString = values.map(function (v, i) { return "L" + (i * step) + "," + (((v - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0])) + range[0]) ;}).join()
    path.setAttribute("d", "M" + pathString.substring(1));
    return sparkline;
}

const checkForRepoPage = () => {
    let repoURI = window.location.pathname.substring(1)
    repoURI = repoURI.endsWith('/') ? repoURI.slice(0, -1) : repoURI
    let type = pageType(repoURI)

    if (type == "blob") {
        getAPIData(repoURI, (scores) => {
            for (const line in scores) {
                let [score, errorType, issueUrl, history] = scores[line];

                const gutterElem = document.getElementById('L' + line);
                if (gutterElem) {
                    gutterElem.className += " buggy-gutter";
                    gutterElem.style.cssText = ("background-position: 0 " + Math.round(score * 100) + "%;");
                }
                const lineElem = document.getElementById('LC' + line);
                if (lineElem) {
                    lineElem.className += " buggy-line";
                    lineElem.style.cssText = ("background-position: 0 " + Math.round(score * 100) + "%;");


                    let link = document.createElement("a");
                    link.href = issueUrl;
                    link.text = errorType;
                    lineElem.appendChild(link);

                    lineElem.appendChild(makeSparkline(history));
                }
            }
        })
    } else if (type == "tree") {
        getAPIData(repoURI, (scores) => {
            for (const file in scores) {
                let score = scores[file];
                const fileLink = document.querySelector('a[title="' + file + '"]');
                if (fileLink) {
                    let fileRow = fileLink.parentElement.parentElement.parentElement;
                    fileRow.className += " buggy-file";
                    fileRow.style.cssText = ("background-position: 0 " + Math.round(score * 100) + "%;");
                }
            }
        });
    }
}

storage.get(GITHUB_TOKEN_KEY, function (data) {
    githubToken = data[GITHUB_TOKEN_KEY]

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes[GITHUB_TOKEN_KEY]) {
            githubToken = changes[GITHUB_TOKEN_KEY].newValue
        }
    })

    document.addEventListener('pjax:end', checkForRepoPage, false)

    checkForRepoPage()
})
