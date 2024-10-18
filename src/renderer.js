const { ipcRenderer } = require('electron');
const { Buffer } = require('buffer');
const path = require('path');
const fs = require('fs');
const semver = require('semver');
const AdmZip = require('adm-zip');

const urlInput = document.getElementById('url');
const saveUrlButton = document.getElementById('saveUrlButton');
const storedUrlsList = document.getElementById('storedUrlsList');
const availableVCCPackages = document.getElementById('projectVCC');
const addProjectButton = document.getElementById('addProjectButton');
const storedProjectsList = document.getElementById('storedProjectsList');
const appVersionElement = document.getElementById('app-version');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const projectDropdown = document.getElementById('projectDropdown');
const projectInfo = document.getElementById('project-info');
const projectNameElement = document.getElementById('project-name');
const unityVersionElement = document.getElementById('unity-version');
const installedPackagesList = document.getElementById('installed-packages');
const unityVersionInput = document.getElementById('unityVersion');
const unityPathInput = document.getElementById('unityPath');
const addUnityVersionButton = document.getElementById('addUnityVersionButton');
const storedUnityVersionsList = document.getElementById('storedUnityVersionsList');
const vccListingsTab = document.querySelector('.tab[data-tab="vcc-listings"]');

vccListingsTab.addEventListener('click', () => {
  console.log('vccListingsTab clicked'); // Debugging statement
  ipcRenderer.send('get-vcc-urls');
});

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
  console.log('URL saved event received:', urls); // Debugging statement
  displayStoredUrls(urls, storedUrlsList, 'vcc-listings');
});

ipcRenderer.on('urls', (event, urls) => {
  console.log('URLs event received:', urls); // Debugging statement
  displayStoredUrls(urls, storedUrlsList, 'vcc-listings');
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
  // Refresh the project info section
  refreshProjectInfo();
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

async function displayStoredUrls(urls, targetElement, mode) {
  console.log('Displaying stored URLs:', urls); // Debugging statement
  console.log('Mode:', mode); // Debugging statement

  // if mode is 'none' then clear the target element
  if (mode === 'none') {
    targetElement.innerHTML = '';
    return;
  }

  const parentElement = targetElement; // set up the parent element (as we are going to get a new target element)

  // if mode is 'unity-project' then add a title to the list
  if (mode === 'unity-project') {
    parentElement.innerHTML = '';
    const title = document.createElement('div');
    title.classList.add('package-title');
    title.innerHTML = `
        <h4>Available VCC Packages</h4>
        <ul id="availableVCCPackages"></ul>
    `;
    parentElement.appendChild(title, parentElement.firstChild);

    // set  the target element for the rest of the function to the availableVCCPackages element
    targetElement = document.getElementById('availableVCCPackages');
  }

  targetElement.innerHTML = '';

  for (const url of urls) {
    try {
      console.log(`Fetching URL: ${url}`);
      let response;
      try {
        response = await fetch(url);
        console.log('Response:', response); // Debugging statement
        if (!response || !response.ok) {
          throw new Error(`HTTP error! status: ${response ? response.status : 'unknown'}`);
        }
      } catch (e) {
        console.error('fetch failed:', e);
        continue; // Skip to the next URL
      }
      const data = await response.json();
      console.log(`Fetched data:`, data);

      if (data.packages) {
        let isFirstPackage = true;
        const packageNames = Object.keys(data.packages);
        for (const packageName of packageNames) {
          const packageInfo = data.packages[packageName];
          console.log(`Extracted package info for ${packageName}:`, packageInfo);

          const versions = Object.keys(packageInfo.versions || {}).sort(semver.rcompare);
          console.log(`Sorted versions for ${packageName}:`, versions);

          const latestVersion = versions[0]; // The first element is the latest version after sorting
          const li = document.createElement('li');
          li.classList.add('listing-box');
          li.innerHTML = `
            ${(isFirstPackage && mode === 'vcc-listings') ? '<button class="remove-button">X</button>' : (mode === 'unity-project' ? '' : '<div class="spacer"></div>')}
            <div class="info">
              <h3>${packageName} <span class="latest-version">${latestVersion ? `(Latest version ${latestVersion})` : ''}</span></h3>
              <p>${url}</p>
            </div>
            ${(versions.length && mode === 'unity-project') ? `<select class="version-dropdown">${versions.map(version => `<option value="${version}">${version}</option>`).join('')}</select>` : ''}
            ${(mode === 'unity-project') ? `<button class="add-button project-info-add-button" data-package='${JSON.stringify({ name: packageName, url, versions })}'>Add</button>` : ''}
          `;
          console.log('isFirstPackage:', isFirstPackage); // Debugging statement
          if (isFirstPackage && mode === 'vcc-listings') {
            li.querySelector('.remove-button').addEventListener('click', () => {
              const packageList = packageNames.join(', ');
              if (confirm(`Are you sure you want to remove this listing? This will remove the following packages: ${packageList}`)) {
                ipcRenderer.send('delete-url', url);
                // Refresh the project info section
                refreshProjectInfo();
              }
            });
            isFirstPackage = false;
          }
          targetElement.appendChild(li);
        }
      } else {
        throw new Error('No packages found in the listing');
      }
    } catch (error) {
      console.error('Failed to fetch or parse listing:', error);
      console.error('Error stack:', error.stack); // Detailed error stack
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
          // Refresh the project info section
          refreshProjectInfo();
        }
      });
      targetElement.appendChild(li);
    }
  }
}

document.addEventListener('click', async (event) => {
  if (event.target.classList.contains('add-button')) {
    const packageData = JSON.parse(event.target.getAttribute('data-package'));
    const selectedVersion = event.target.previousElementSibling.value;
    const projectPath = projectDropdown.value;

    if (projectPath && selectedVersion) {
      await addVccPackage(projectPath, packageData.name, selectedVersion, packageData.url);
      await refreshProjectInfo();
    }
  }
});

// Listen for the 'url-removed' event to update the UI
ipcRenderer.on('url-removed', (event, urls) => {
  console.log('URL removed event received:', urls); // Debugging statement
  displayStoredUrls(urls, storedUrlsList, 'vcc-listings');
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
  // if selected project is empty call displayStoredUrls(urls, availableVCCPackages, 'none'); to clear the availableVCCPackages list
  if (event.target.value === '') {
    displayStoredUrls([], availableVCCPackages, 'none');
  }
});

// Retrieve stored URLs and projects on load
ipcRenderer.send('get-vcc-urls');
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
        isGitUrl: manifestJson.dependencies[pkgName].endsWith('.git') || manifestJson.dependencies[pkgName].match(/\.git#.+/),
        listingUrl: '' // Initialize listing URL as empty
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
        isVpmPackage: true, // Mark as VPM package
        listingUrl: '' // Initialize listing URL as empty
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
            isFolderPackage: true, // Mark as folder package
            listingUrl: '' // No listing URL for folder packages
          });
        }
      }
    }

    // Retrieve VCC listings info
    const vccListings = await ipcRenderer.invoke('get-vcc-listings');

    // Match package names with VCC listings to get URLs and latest versions
    for (const pkg of packages) {
      const matchingListing = vccListings.find(listing => listing.name === pkg.name);
      if (matchingListing) {
        pkg.listingUrl = matchingListing.url;
        const vccData = await fetch(matchingListing.url).then(res => res.json());
        const latestVersion = Object.keys(vccData.packages[pkg.name].versions).sort(semver.rcompare)[0];
        pkg.latestVersion = latestVersion;
      }
    }

    // check all vcc packages and add if there is no listing url set the url to 'Unknown VCC Listing'
    packages.forEach(pkg => {
      if (pkg.isVpmPackage && !pkg.listingUrl) {
        pkg.listingUrl = 'Unknown VCC Listing';
      }
    });

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
        ${filteredPackages.length ? filteredPackages.map(pkg => `
          <li class="listing-box">
            <div class="info-icons-group">
              ${pkg.isGitUrl ? '<img src="../src/images/Git-Icon-White.svg" alt="Git Logo" class="git-logo">' : ''}
              ${pkg.isVpmPackage ? '<img src="../src/images/vcc-logo.png" alt="VCC Logo" class="vcc-logo">' : ''}
              ${pkg.isFolderPackage ? '<img src="../src/images/folder.svg" alt="Folder Icon" class="folder-icon">' : ''}
            </div>
            <div class="info">
              <h3>${pkg.name}</h3>
              ${(pkg.isGitUrl) ? `<span class="latest-version">(${pkg.version})</span>` : ``}
              ${(pkg.listingUrl) ? `<p class="latest-version">${pkg.listingUrl}</p>` : ``}
            </div>
            ${(pkg.isGitUrl && pkg.version.includes('#')) || pkg.isVpmPackage || pkg.isFolderPackage ? `<div class="current-version">${pkg.version}</div>` : ''}
            <div class="button-group ${pkg.latestVersion && semver.lt(pkg.version, pkg.latestVersion) ? 'has-upgrade' : ''}">
              ${pkg.listingUrl && !pkg.isVpmPackage ? `<button class="vcc-listing-relink-button" data-package='${JSON.stringify(pkg)}'>Link to listing</button>` : ''}
              ${pkg.isVpmPackage ? `<button class="vcc-package-remove-button remove-button" data-package='${JSON.stringify(pkg)}'>Remove<br/>Package</button>` : ''}
              ${pkg.latestVersion && semver.lt(pkg.version, pkg.latestVersion) ? `<button class="vcc-package-upgrade-button upgrade-button" data-package='${JSON.stringify(pkg)}'>Upgrade to<br/>Latest</button>` : ''}
            </div>
          </li>
        `).join('') : '<li>No packages installed</li>'}
      </ul>
      <button id="openProjectButton" class="open-button">Open Project</button>
    `;
    projectInfo.classList.remove('center-text');

    // Retrieve URLs
    const urls = await ipcRenderer.invoke('get-vcc-urls');
    console.log('Retrieved URLs in refreshProjectInfo:', urls); // Debugging statement
    displayStoredUrls(urls, availableVCCPackages, 'unity-project');

    const unityVersions = await ipcRenderer.invoke('get-unity-versions');
    const openProjectButton = document.getElementById('openProjectButton');
    const unityVersionWarning = document.getElementById('unity-version-warning');
    const goToUnityVersionsButton = document.getElementById('goToUnityVersionsButton');

    if (!unityVersionExists(unityVersion, unityVersions)) {
      unityVersionWarning.style.display = 'block';
      openProjectButton.disabled = true;
      openProjectButton.style.display = 'none';
    } else {
      unityVersionWarning.style.display = 'none';
      openProjectButton.disabled = false;
      openProjectButton.style.display = 'block';
    }

    openProjectButton.addEventListener('click', () => {
      ipcRenderer.send('open-project', selectedProjectPath);
    });

    goToUnityVersionsButton.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="unity-versions"]').click();
    });

    // Add event listeners to "Link to listing" buttons
    document.querySelectorAll('.vcc-listing-relink-button').forEach(button => {
      button.addEventListener('click', async (event) => {
        const pkg = JSON.parse(event.target.getAttribute('data-package'));
        await linkToListing(selectedProjectPath, pkg);
        await refreshProjectInfo(); // Refresh the project info section
      });
    });

    // Add event listeners to "Remove" buttons
    document.querySelectorAll('.vcc-package-remove-button').forEach(button => {
      button.addEventListener('click', async (event) => {
        const pkg = JSON.parse(event.target.getAttribute('data-package'));
        await removeVccPackage(selectedProjectPath, pkg);
        await refreshProjectInfo(); // Refresh the project info section
      });
    });

    // Add event listeners to "Upgrade to Latest" buttons
    document.querySelectorAll('.vcc-package-upgrade-button').forEach(button => {
      button.addEventListener('click', async (event) => {
        const pkg = JSON.parse(event.target.getAttribute('data-package'));
        await addVccPackage(selectedProjectPath, pkg.name, pkg.latestVersion, pkg.listingUrl);
        await refreshProjectInfo(); // Refresh the project info section
      });
    });
  } else {
    projectInfo.innerHTML = '<p class="center-text">Please select a project</p>';
    projectInfo.classList.add('center-text');
  }
}

async function addVccPackage(projectPath, packageName, version, url) {
  const vpmManifestPath = path.join(projectPath, 'Packages', 'vpm-manifest.json');
  const packageFolderPath = path.join(projectPath, 'Packages', packageName);

  showNotificationBanner('Adding package to manifest...', '#003366', 0);

  // Update vpm-manifest.json
  if (fs.existsSync(vpmManifestPath)) {
    const vpmManifestContent = fs.readFileSync(vpmManifestPath, 'utf8');
    const vpmManifestJson = JSON.parse(vpmManifestContent);

    // Add package to dependencies and locked sections
    vpmManifestJson.dependencies[packageName] = { version };
    vpmManifestJson.locked[packageName] = { version, dependencies: {} };

    // Write updated content back to vpm-manifest.json
    fs.writeFileSync(vpmManifestPath, JSON.stringify(vpmManifestJson, null, 2), 'utf8');
  }

  // get vcc listing json
  const vccResponse = await fetch(url);
  const vccData = await vccResponse.json();
  const packageUrl = vccData.packages[packageName].versions[version].url;

  showNotificationBanner('Downloading package...', '#003366', 0);

  // Download the package with progress tracking
  console.log(`Downloading package from: ${packageUrl}`);
  const response = await fetch(packageUrl);
  if (!response.ok) {
    showNotificationBanner('Failed to download package', '#F44336', 3000);
    throw new Error(`Failed to download package: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    showNotificationBanner('Failed to get content length', '#F44336', 3000);
    throw new Error('Failed to get content length');
  }

  const totalBytes = parseInt(contentLength, 10);
  let loadedBytes = 0;

  const reader = response.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.length;
    const percentage = ((loadedBytes / totalBytes) * 100).toFixed(2);
    showNotificationBanner(`Downloading package... ${percentage}%`, '#003366', 0);
  }

  // Combine all chunks into a single buffer
  const arrayBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
  const buffer = Buffer.from(arrayBuffer);

  // Save the buffer to a file
  const zipFilePath = `${packageFolderPath}.zip`;
  fs.writeFileSync(zipFilePath, buffer);

  // Show notification banner
  showNotificationBanner('Installing package...', '#003366', 0);

  try {
    // Unzip the package using adm-zip
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(packageFolderPath, true);

    // Remove the zip file after unzipping
    fs.unlinkSync(zipFilePath);

    // If unzip fails, show error message
    if (!fs.existsSync(packageFolderPath)) {
      showNotificationBanner('Failed to unzip package', '#F44336', 3000);
      return; // Exit the function
    }

    // Show notification banner
    showNotificationBanner('Package added successfully!', '#4CAF50', 3000);
  } catch (error) {
    console.error('Error during unzip process:', error);
    showNotificationBanner('Failed to unzip package', '#F44336', 3000);
  }
}

async function removeVccPackage(projectPath, pkg) {
  const vpmManifestPath = path.join(projectPath, 'Packages', 'vpm-manifest.json');
  if (fs.existsSync(vpmManifestPath)) {
    const vpmManifestContent = fs.readFileSync(vpmManifestPath, 'utf8');
    const vpmManifestJson = JSON.parse(vpmManifestContent);

    // Remove package from dependencies and locked sections
    delete vpmManifestJson.dependencies[pkg.name];
    delete vpmManifestJson.locked[pkg.name];

    // Write updated content back to vpm-manifest.json
    fs.writeFileSync(vpmManifestPath, JSON.stringify(vpmManifestJson, null, 2), 'utf8');

    // Remove the related folder in the Packages directory
    const packageFolderPath = path.join(projectPath, 'Packages', pkg.name);
    if (fs.existsSync(packageFolderPath)) {
      fs.rmSync(packageFolderPath, { recursive: true, force: true });
    }

    // Show notification banner
    showNotificationBanner('Package removed successfully!', '#4CAF50', 3000);
  }
}

async function linkToListing(projectPath, pkg) {
  const vpmManifestPath = path.join(projectPath, 'Packages', 'vpm-manifest.json');
  if (fs.existsSync(vpmManifestPath)) {
    const vpmManifestContent = fs.readFileSync(vpmManifestPath, 'utf8');
    const vpmManifestJson = JSON.parse(vpmManifestContent);

    // Add package to dependencies and locked sections
    vpmManifestJson.dependencies[pkg.name] = { version: pkg.version };
    vpmManifestJson.locked[pkg.name] = { version: pkg.version, dependencies: {} };

    // Write updated content back to vpm-manifest.json
    fs.writeFileSync(vpmManifestPath, JSON.stringify(vpmManifestJson, null, 2), 'utf8');
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

function showNotificationBanner(message, color = '#4CAF50', duration = 3000) {
  const banner = document.getElementById('notification-banner');
  banner.textContent = message;
  banner.style.borderColor = color;
  banner.style.backgroundColor = '#333333'; // Ensure background color is set
  banner.classList.add('show');

  if (duration === 0) {
    // If duration is 0, set the border color to be always visible
    banner.style.borderColor = color;
    banner.style.animation = ''; // Remove any existing animation
    return; // Skip the rest of the function
  }

  // Create a keyframe animation for the border fade-out effect
  const fadeOutKeyframes = `
    @keyframes borderFadeOut {
      0% {
        border-color: ${color};
      }
      100% {
        border-color: rgba(${hexToRgb(color)}, 0); /* Fully transparent */
      }
    }
  `;

  // Append the keyframes to the document's style
  const styleSheet = document.styleSheets[0];
  styleSheet.insertRule(fadeOutKeyframes, styleSheet.cssRules.length);

  // Apply the animation to the banner
  banner.style.animation = `borderFadeOut ${duration}ms forwards`;

  setTimeout(() => {
    banner.classList.remove('show');
  }, duration); // Hide after the specified duration
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}
