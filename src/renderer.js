const { ipcRenderer } = require('electron');
const semver = require('semver');

const urlInput = document.getElementById('url');
const saveUrlButton = document.getElementById('saveUrlButton');
const storedUrlsList = document.getElementById('storedUrlsList');
const addProjectButton = document.getElementById('addProjectButton');
const storedProjectsList = document.getElementById('storedProjectsList');
const appVersionElement = document.getElementById('app-version');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

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

ipcRenderer.on('project-saved', (event, projects) => {
  displayStoredProjects(projects);
});

ipcRenderer.on('projects', (event, projects) => {
  displayStoredProjects(projects);
});

saveUrlButton.addEventListener('click', () => {
  const url = urlInput.value;
  ipcRenderer.send('save-url', url);
});

addProjectButton.addEventListener('click', () => {
  ipcRenderer.send('select-project-folder');
});

storedUrlsList.addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    storedUrlsList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    event.target.classList.add('selected');
  }
});

storedProjectsList.addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    storedProjectsList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    event.target.classList.add('selected');
  }
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.getAttribute('data-tab');
    tabContents.forEach(content => {
      if (content.id === target) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  });
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

function displayStoredProjects(projects) {
  storedProjectsList.innerHTML = '';
  for (const projectPath of projects) {
    const li = document.createElement('li');
    li.classList.add('listing-box');
    li.innerHTML = `
      <button class="remove-button">X</button>
      <div class="info">
        <h3>${projectPath}</h3>
      </div>
    `;
    li.querySelector('.remove-button').addEventListener('click', () => {
      if (confirm('Are you sure you want to remove this project?')) {
        ipcRenderer.send('delete-project', projectPath);
      }
    });
    storedProjectsList.appendChild(li);
  }
}

// Retrieve stored URLs and projects on load
ipcRenderer.send('get-urls');
ipcRenderer.send('get-projects');