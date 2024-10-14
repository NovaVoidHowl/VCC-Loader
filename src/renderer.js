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
const projectDropdown = document.getElementById('projectDropdown');
const projectInfoContainer = document.getElementById('project-info-container');
const projectInfo = document.getElementById('project-info');
const projectNameElement = document.getElementById('project-name');
const unityVersionElement = document.getElementById('unity-version');
const installedPackagesList = document.getElementById('installed-packages');

let projects = []; // Global variable to store projects

// Request the version number from the main process on load
ipcRenderer.send('request-version');

// Receive the version number from the main process
ipcRenderer.on('app-version', (event, version) => {
  appVersionElement.textContent = version;
});

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
      }
    });
    storedProjectsList.appendChild(li);
  }
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

// Event listener for project dropdown change
projectDropdown.addEventListener('change', (event) => {
  const selectedProjectPath = event.target.value;
  console.log('Selected project path:', selectedProjectPath);
  if (selectedProjectPath) {
    const selectedProject = projects.find(project => project.path === selectedProjectPath);
    console.log('Selected project:', selectedProject);
    if (selectedProject) {
      projectInfo.innerHTML = `
        <h3>Project Path: <span id="project-name">${selectedProject.path}</span></h3>
        <p>Unity Version: <span id="unity-version">${selectedProject.version}</span></p>
        <h4>Installed Packages:</h4>
        <ul id="installed-packages">
          ${selectedProject.packages ? selectedProject.packages.filter(pkg => !pkg.isDefault).map(pkg => `<li>${pkg.name} (${pkg.version})</li>`).join('') : '<li>No packages installed</li>'}
        </ul>
      `;
      projectInfo.classList.remove('center-text');
    }
  } else {
    projectInfo.innerHTML = '<p class="center-text">Please select a project</p>';
    projectInfo.classList.add('center-text');
  }
});

// Retrieve stored URLs and projects on load
ipcRenderer.send('get-urls');
ipcRenderer.send('get-projects');

// Set initial info section text
projectInfo.innerHTML = '<p class="center-text">Please select a project</p>';
projectInfo.classList.add('center-text');