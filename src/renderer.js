const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const semver = require('semver');

const urlInput = document.getElementById('url');
const saveUrlButton = document.getElementById('saveUrlButton');
const storedUrlsList = document.getElementById('storedUrlsList');
const addProjectButton = document.getElementById('addProjectButton');
const storedProjectsList = document.getElementById('storedProjectsList');
const appVersionElement = document.getElementById('app-version');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const projectDropdown = document.getElementById('projectDropdown');
const projectInfoContainer = document.getElementById('project-info-container');
const projectInfo = document.getElementById('project-info');
const projectNameElement = document.getElementById('project-name');
const unityVersionElement = document.getElementById('unity-version');
const installedPackagesList = document.getElementById('installed-packages');
const unityVersionInput = document.getElementById('unityVersion');
const unityPathInput = document.getElementById('unityPath');
const addUnityVersionButton = document.getElementById('addUnityVersionButton');
const storedUnityVersionsList = document.getElementById('storedUnityVersionsList');

let projects = []; // Global variable to store projects

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
  if (url) {
    urlInput.value = url;
    console.log(`URL input box set to deeplinking URL: ${url}`);
    // Open the VCC Listings page
    document.querySelector('.tab[data-tab="vcc-listings"]').click();
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
  populateProjectDropdown(projects); // Refresh the dropdown with the updated projects list
  clearProjectInfo(); // Clear the project info section
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
      console.log(`Fetching URL: ${url}`);
      const response = await fetch(url);
      const data = await response.json();
      console.log(`Fetched data:`, data);

      const packageInfo = data.packages?.[Object.keys(data.packages)[0]];
      console.log(`Extracted package info:`, packageInfo);

      const versions = Object.keys(packageInfo?.versions || {}).sort(semver.rcompare);
      console.log(`Sorted versions:`, versions);

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

ipcRenderer.on('projects', (event, savedProjects) => {
  projects = savedProjects; // Update global projects variable
  console.log('Projects loaded:', projects);
  displayStoredProjects(projects);
  populateProjectDropdown(projects);
});

function displayStoredProjects(projects) {
  storedProjectsList.innerHTML = '';
  for (const project of projects) {
    const li = document.createElement('li');
    li.classList.add('listing-box');
    li.innerHTML = `
      <button class="remove-button">X</button>
      <div class="info">
        <h3>${project.path}</h3>
        <p>Unity Version: ${project.version}</p>
      </div>
    `;
    li.querySelector('.remove-button').addEventListener('click', () => {
      if (confirm('Are you sure you want to remove this project?')) {
        ipcRenderer.send('delete-project', project.path);
        clearProjectInfo(); // Clear the project info section
      }
    });
    storedProjectsList.appendChild(li);
  }
  populateProjectDropdown(projects); // Refresh the dropdown with the updated projects list
}

// Function to clear the project info section
function clearProjectInfo() {
  projectInfo.innerHTML = '<p class="center-text">Please select a project</p>';
  projectInfo.classList.add('center-text');
  projectNameElement.textContent = '';
  unityVersionElement.textContent = '';
  installedPackagesList.innerHTML = '';
}

// Function to populate the project dropdown
function populateProjectDropdown(projects) {
  projectDropdown.innerHTML = '<option value="">Select a project</option>';
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.path;
    option.textContent = `${project.path} (Unity ${project.version})`;
    projectDropdown.appendChild(option);
  });
}

// Function to check if a Unity version exists in the stored versions
function unityVersionExists(version, unityVersions) {
  return unityVersions.some(uv => uv.version === version);
}

// Event listener for project dropdown change
projectDropdown.addEventListener('change', async (event) => {
  await refreshProjectInfo();
});

// Retrieve stored URLs and projects on load
ipcRenderer.send('get-urls');
ipcRenderer.send('get-projects');

// Set initial info section text
projectInfo.innerHTML = '<p class="center-text">Please select a project</p>';
projectInfo.classList.add('center-text');

// Handle adding a new Unity version
addUnityVersionButton.addEventListener('click', () => {
  const version = unityVersionInput.value;
  const path = unityPathInput.value;
  if (version && path) {
    ipcRenderer.send('save-unity-version', { version, path });
  }
});

// Request stored Unity versions on load
ipcRenderer.send('request-unity-versions');

// Display stored Unity versions
ipcRenderer.on('unity-versions', (event, unityVersions) => {
  storedUnityVersionsList.innerHTML = '';
  unityVersions.forEach(({ version, path }) => {
    const li = document.createElement('li');
    li.classList.add('listing-box');
    li.innerHTML = `
      <button class="remove-button">X</button>
      <div class="info">
        <h3>${version}</h3>
        <p>${path}</p>
      </div>
    `;
    li.querySelector('.remove-button').addEventListener('click', () => {
      if (confirm('Are you sure you want to remove this Unity version?')) {
        ipcRenderer.send('delete-unity-version', version);
      }
    });
    storedUnityVersionsList.appendChild(li);
  });
});

// Open file picker when clicking on the Unity path input field
unityPathInput.addEventListener('click', () => {
  ipcRenderer.invoke('open-file-dialog').then(result => {
    if (!result.canceled) {
      unityPathInput.value = result.filePaths[0];
      unityVersionInput.value = result.unityVersion; // Auto-fill the Unity version
    }
  });
});

// Function to refresh the project info section
async function refreshProjectInfo() {
  const selectedProjectPath = projectDropdown.value;
  if (selectedProjectPath) {
    const projectVersionPath = path.join(selectedProjectPath, 'ProjectSettings', 'ProjectVersion.txt');
    let unityVersion = 'Unknown';
    if (fs.existsSync(projectVersionPath)) {
      const versionContent = fs.readFileSync(projectVersionPath, 'utf8');
      const versionMatch = versionContent.match(/m_EditorVersion: (.+)/);
      if (versionMatch) {
        unityVersion = versionMatch[1];
      }
    }

    const packagesManifestPath = path.join(selectedProjectPath, 'Packages', 'manifest.json');
    const vpmManifestPath = path.join(selectedProjectPath, 'Packages', 'vpm-manifest.json');
    let packages = [];

    if (fs.existsSync(packagesManifestPath)) {
      console.log('Found Packages manifest file');
      const manifestContent = fs.readFileSync(packagesManifestPath, 'utf8');
      const manifestJson = JSON.parse(manifestContent);
      packages = Object.keys(manifestJson.dependencies).map(pkgName => ({
        name: pkgName,
        version: manifestJson.dependencies[pkgName],
        isDefault: pkgName.startsWith('com.unity'),
        isGitUrl: manifestJson.dependencies[pkgName].endsWith('.git') || manifestJson.dependencies[pkgName].match(/\.git#.+/)
      }));
    }

    if (fs.existsSync(vpmManifestPath)) {
      console.log('Found VPM manifest file');
      const vpmContent = fs.readFileSync(vpmManifestPath, 'utf8');
      const vpmJson = JSON.parse(vpmContent);
      const vpmPackages = Object.keys(vpmJson.locked).map(pkgName => ({
        name: pkgName,
        version: vpmJson.locked[pkgName].version,
        isDefault: false,
        isGitUrl: false, // VPM packages are never Git repositories
        isVpmPackage: true // Mark as VPM package
      }));
      packages = packages.concat(vpmPackages);
    }

    // Read subfolders in Packages directory
    const packagesDir = path.join(selectedProjectPath, 'Packages');
    const subfolders = fs.readdirSync(packagesDir).filter(subfolder => {
      const subfolderPath = path.join(packagesDir, subfolder);
      return fs.lstatSync(subfolderPath).isDirectory();
    });

    // Check for package.json in each subfolder
    for (const subfolder of subfolders) {
      const packageJsonPath = path.join(packagesDir, subfolder, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        const packageName = packageJson.name;
        const packageVersion = packageJson.version;

        // Check if the package is already listed in VPM packages
        const isDuplicate = packages.some(pkg => pkg.name === packageName && pkg.version === packageVersion);
        if (!isDuplicate) {
          packages.push({
            name: packageName,
            version: packageVersion,
            isDefault: false,
            isGitUrl: false,
            isVpmPackage: false,
            isFolderPackage: true // Mark as folder package
          });
        }
      }
    }

    // Filter out com.unity packages
    const filteredPackages = packages.filter(pkg => !pkg.isDefault);
    projectInfo.innerHTML = `
      <div id="unity-version-warning" class="warning-banner" style="display: none;">
        <p>The Unity version for this project is not in the list. Please add it first.</p>
        <button id="goToUnityVersionsButton" class="add-button">Go to Unity Versions</button>
      </div>
      <h3>Project Path: <span id="project-name">${selectedProjectPath}</span></h3>
      <p>Unity Version: <span id="unity-version">${unityVersion}</span></p>
      <h4>Installed Packages:</h4>
      <ul id="installed-packages">
        ${filteredPackages.length ? filteredPackages.map(pkg => {
          let displayVersion = pkg.version;
          if (pkg.isGitUrl && pkg.version.includes('#')) {
            const versionParts = pkg.version.split('#');
            displayVersion = `Current Version ${versionParts[1]}`;
          }
          if (pkg.isVpmPackage) {
            displayVersion = `Current Version ${pkg.version}`;
          }
          if (pkg.isFolderPackage) {
            displayVersion = `Current Version ${pkg.version}`;
          }
          return `
            <li class="listing-box">
              <div class="info-icons-group">
                ${pkg.isGitUrl ? '<img src="../src/images/Git-Icon-White.svg" alt="Git Logo" class="git-logo">' : ''}
                ${pkg.isVpmPackage ? '<img src="../src/images/vcc-logo.png" alt="VCC Logo" class="vcc-logo">' : ''}
                ${pkg.isFolderPackage ? '<img src="../src/images/folder.svg" alt="Folder Icon" class="folder-icon">' : ''}
              </div>
              <div class="info">
                <h3>${pkg.name}</h3>
                ${(pkg.isGitUrl) ? `<span class="latest-version">(${pkg.version})</span>` :``}
              </div>
              ${(pkg.isGitUrl && pkg.version.includes('#')) || pkg.isVpmPackage || pkg.isFolderPackage ? `<div class="current-version">${displayVersion}</div>` : ''}
            </li>
          `;
        }).join('') : '<li>No packages installed</li>'}
      </ul>
      <button id="openProjectButton" class="open-button">Open Project</button>
    `;
    projectInfo.classList.remove('center-text');

    const unityVersions = await ipcRenderer.invoke('get-unity-versions');
    const openProjectButton = document.getElementById('openProjectButton');
    const unityVersionWarning = document.getElementById('unity-version-warning');
    const goToUnityVersionsButton = document.getElementById('goToUnityVersionsButton');

    if (!unityVersionExists(unityVersion, unityVersions)) {
      unityVersionWarning.style.display = 'block';
      openProjectButton.disabled = true;
    } else {
      unityVersionWarning.style.display = 'none';
      openProjectButton.disabled = false;
    }

    openProjectButton.addEventListener('click', () => {
      ipcRenderer.send('open-project', selectedProjectPath);
    });

    goToUnityVersionsButton.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="unity-versions"]').click();
    });
  } else {
    projectInfo.innerHTML = '<p class="center-text">Please select a project</p>';
    projectInfo.classList.add('center-text');
  }
}

// Request stored Unity versions on load
ipcRenderer.send('request-unity-versions');

// Display stored Unity versions and refresh project info section
ipcRenderer.on('unity-versions', (event, unityVersions) => {
  storedUnityVersionsList.innerHTML = '';
  unityVersions.forEach(({ version, path }) => {
    const li = document.createElement('li');
    li.classList.add('listing-box');
    li.innerHTML = `
      <button class="remove-button">X</button>
      <div class="info">
        <h3>${version}</h3>
        <p>${path}</p>
      </div>
    `;
    li.querySelector('.remove-button').addEventListener('click', () => {
      if (confirm('Are you sure you want to remove this Unity version?')) {
        ipcRenderer.send('delete-unity-version', version);
      }
    });
    storedUnityVersionsList.appendChild(li);
  });

  // Refresh the project info section
  refreshProjectInfo();
});