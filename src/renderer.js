const { ipcRenderer } = require('electron');

const fetchButton = document.getElementById('fetchButton');
const addButton = document.getElementById('addButton');
const urlInput = document.getElementById('url');
const packageList = document.getElementById('packageList');
const saveUrlButton = document.getElementById('saveUrlButton');
const storedUrlsList = document.getElementById('storedUrlsList');
const deleteUrlButton = document.getElementById('deleteUrlButton');
const viewUrlButton = document.getElementById('viewUrlButton');

ipcRenderer.on('set-url', (event, url) => {
    console.log(`Received URL in renderer: ${url}`);
    if (urlInput) {
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

fetchButton.addEventListener('click', async () => {
  const url = urlInput.value;
  try {
    const response = await fetch(url);
    const data = await response.json();
    displayPackages(data);
  } catch (error) {
    alert('Failed to fetch listing: ' + error);
  }
});

function displayPackages(data) {
  packageList.innerHTML = '';
  const packages = data.packages || {};
  for (const [packageName, packageInfo] of Object.entries(packages)) {
    const versions = packageInfo.versions || {};
    for (const version of Object.keys(versions)) {
      const li = document.createElement('li');
      li.textContent = `${packageName} - ${version}`;
      packageList.appendChild(li);
    }
  }
}

addButton.addEventListener('click', () => {
  const selectedPackage = packageList.querySelector('li.selected');
  if (selectedPackage) {
    alert('Added package: ' + selectedPackage.textContent);
  } else {
    alert('No package selected');
  }
});

packageList.addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    packageList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    event.target.classList.add('selected');
  }
});

saveUrlButton.addEventListener('click', () => {
  const url = urlInput.value;
  ipcRenderer.send('save-url', url);
});

deleteUrlButton.addEventListener('click', () => {
  const selectedUrl = storedUrlsList.querySelector('li.selected');
  if (selectedUrl) {
    ipcRenderer.send('delete-url', selectedUrl.textContent);
  } else {
    alert('No URL selected');
  }
});

viewUrlButton.addEventListener('click', () => {
  const selectedUrl = storedUrlsList.querySelector('li.selected');
  if (selectedUrl) {
    urlInput.value = selectedUrl.textContent;
  } else {
    alert('No URL selected');
  }
});

storedUrlsList.addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    storedUrlsList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    event.target.classList.add('selected');
  }
});

function displayStoredUrls(urls) {
  storedUrlsList.innerHTML = '';
  urls.forEach(url => {
    const li = document.createElement('li');
    li.textContent = url;
    storedUrlsList.appendChild(li);
  });
}

// Retrieve stored URLs on load
ipcRenderer.send('get-urls');