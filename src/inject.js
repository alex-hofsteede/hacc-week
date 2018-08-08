/* global fetch, Request, Headers, chrome, localStorage */

const API = 'https://api.github.com/repos/'
const GITHUB_TOKEN_KEY = 'x-github-token'

const storage = chrome.storage.sync || chrome.storage.local

let githubToken

const isBlob = (uri) => {
  const repoURI = uri.split('/')

  return repoURI.length > 3 || repoURI[2] === 'blob'
}

const getRepoInfoURI = (uri) => {
  const repoURI = uri.split('/')

  return repoURI[0] + '/' + repoURI[1]
}

const getRepoContentURI = (uri) => {
  const repoURI = uri.split('/')
  const treeBranch = repoURI.splice(2, 2, 'contents')

  if (treeBranch && treeBranch[1]) {
    repoURI.push('?ref=' + treeBranch[1])
  }

  return repoURI.join('/')
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

const checkForRepoPage = () => {
  let repoURI = window.location.pathname.substring(1)
  repoURI = repoURI.endsWith('/') ? repoURI.slice(0, -1) : repoURI

  if (isBlob(repoURI)) {
    console.log(repoURI)
    const tdElems = document.querySelector('span.github-repo-size-td')

    if (!tdElems) {
        getAPIData(getRepoContentURI(repoURI), (data) => {
        const scores = {"1": 0.5, "5": 0.1, "10": 1} // = data

        for (const line in scores) {
            const lineElem = document.getElementById('L' + line);
            if (lineElem) {

                lineElem.className += " buggy";
                console.log(("background-position: 0 " + Math.round(scores[line] * 100) + "%;"));
                lineElem.style.cssText = ("background-position: 0 " + Math.round(scores[line] * 100) + "%;");
            }
        }
      })
    }
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
