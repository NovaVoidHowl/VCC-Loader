const { ipcRenderer } = require('electron');
const semver = require('semver');

const urlInput = document.getElementById('url');
const saveUrlButton = document.getElementById('saveUrlButton');
const storedUrlsList = document.getElementById('storedUrlsList');
const appVersionElement = document.getElementById('app-version');

// Request the version number from the main process on load
ipcRenderer.send('request-version');

// Receive the version number from the main process
ipcRenderer.on('app-version', (event, version) => {
  appVersionElement.textContent = version;
});

ipcRenderer.on('set-url', (event, url) => {
    console.log(`Received URL in renderer: ${url}`);
    if (url) {
        urlInput.value = url;
        console.log(`URL input box set to: ${url}`);
    }
});

ipcRenderer.on('deeplinking-url', (event, url) => {
    console.log(`Received deeplinking URL in renderer: ${url}`);
    if (urlInput) {
        urlInput.value = url;
        console.log(`URL input box set to deeplinking URL: ${url}`);
    }
});

ipcRenderer.on('url-saved', (event, urls) => {
    displayStoredUrls(urls);
});

ipcRenderer.on('urls', (event, urls) => {
    displayStoredUrls(urls);
});

saveUrlButton.addEventListener('click', () => {
  const url = urlInput.value;
  ipcRenderer.send('save-url', url);
});

storedUrlsList.addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    storedUrlsList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    event.target.classList.add('selected');
  }
});

async function displayStoredUrls(urls) {
  storedUrlsList.innerHTML = '';
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      const packageInfo = data.packages?.[Object.keys(data.packages)[0]];
      const versions = Object.keys(packageInfo?.versions || {}).sort(semver.rcompare);
      const latestVersion = versions[0]; // The first element is the latest version after sorting
      const li = document.createElement('li');
      li.classList.add('listing-box');
      li.innerHTML = `
        <button class="remove-button">X</button>
        <div class="info">
          <h3>${data.name || 'Invalid / Corrupt listing'} <span class="latest-version">${latestVersion ? `(Latest version ${latestVersion})` : ''}</span></h3>
          <p>${url}</p>
        </div>
        ${versions.length ? `<select class="version-dropdown">${versions.map(version => `<option value="${version}">${version}</option>`).join('')}</select>` : ''}
      `;
      li.querySelector('.remove-button').addEventListener('click', () => {
        if (confirm('Are you sure you want to remove this listing?')) {
          ipcRenderer.send('delete-url', url);
        }
      });
      storedUrlsList.appendChild(li);
    } catch (error) {
      console.error('Failed to fetch or parse listing:', error);
      const li = document.createElement('li');
      li.classList.add('listing-box');
      li.innerHTML = `
        <button class="remove-button">X</button>
        <div class="info">
          <h3>Invalid / Corrupt listing</h3>
          <p>${url}</p>
        </div>
      `;
      li.querySelector('.remove-button').addEventListener('click', () => {
        if (confirm('Are you sure you want to remove this listing?')) {
          ipcRenderer.send('delete-url', url);
        }
      });
      storedUrlsList.appendChild(li);
    }
  }
}

// Retrieve stored URLs on load
ipcRenderer.send('get-urls');