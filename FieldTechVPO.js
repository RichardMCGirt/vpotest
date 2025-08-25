let records = [];
let fetchedRecords = 0;
let totalIncompleteRecords = 0;
let offset = '';
let isLoading = false;
let techniciansWithRecords = new Set();
let branchesWithRecords = new Set();
let currentCheckbox = null;
let currentRecordId = null;
let totalRecords = 0;
let isFetching = false;
let currentSearchTerm = '';

const fieldsToFetch = [
  'ID Number',
  'static Vanir Office',
  'Job Name',
  'Description of Work',
  'static Field Technician',
  'Field Tech Confirmed Job Complete'
];

function showLoadingOverlay() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoadingOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

document.addEventListener("DOMContentLoaded", async function () {
  const displayNameElement = document.getElementById('displayName');
  const techDropdown = document.getElementById('techDropdown');
  const branchDropdown = document.getElementById('branchDropdown'); // ⬅️ new dropdown for branches
  const searchBar = document.getElementById('searchBar');

  // Airtable config
  const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
  const airtableBaseId = 'appQDdkj6ydqUaUkE';
  const airtableTableName = 'tblO72Aw6qplOEAhR';
  const airtableViewId = 'viwAYuyLBtyoHOxPK'; // ✅ optimized view
  const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}?view=${airtableViewId}`;

  // Only fetch these fields
  const fieldsToFetch = [
    'ID Number',
    'static Vanir Office',
    'Job Name',
    'Description of Work',
    'static Field Technician',
    'Field Tech Confirmed Job Complete'
  ];

  // Default headers for axios
  axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;
  const cacheTime = 24 * 60 * 60 * 1000;
  const lastTechFetch = localStorage.getItem('lastTechFetchTime');
  const lastBranchFetch = localStorage.getItem('lastBranchFetchTime');
  const currentTime = new Date().getTime();

  function toggleSearchBarVisibility(recordCount) {
    searchBar.style.display = recordCount < 6 ? 'none' : 'block';
  }

  // --- Search bar filtering ---
  let searchTimeout;
  searchBar.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearchTerm = searchBar.value.toLowerCase();
      renderTableFromRecords();
    }, 300);
  });

  // --- Dropdown population and dedupe (Technicians) ---
  async function fetchTechniciansWithRecords() {
    offset = '';
    techniciansWithRecords = new Set();

    try {
      do {
        const response = await axios.get(`${airtableEndpoint}`, {
          params: {
            offset: offset,
            fields: ['static Field Technician', 'Field Tech Confirmed Job Complete']
          }
        });

        const pageRecords = response.data.records;

        pageRecords.forEach(record => {
          const techName = record.fields['static Field Technician'];
          const isJobComplete = record.fields['Field Tech Confirmed Job Complete'];

          // include techs with incomplete jobs
          if (techName && !isJobComplete) {
            techniciansWithRecords.add(techName);
          }
        });

        offset = response.data.offset || '';
      } while (offset);

      const result = Array.from(techniciansWithRecords).sort();
      return result;

    } catch (error) {
      console.error('❌ Error fetching technicians:', error);
      return [];
    }
  }

  function populateTechDropdownFromCache(technicians) {
    const uniqueTechs = Array.from(new Set(technicians.filter(Boolean)));
    const previouslySelectedTech = localStorage.getItem('fieldTech') || 'all';
    techDropdown.innerHTML = `
      <option value="">Select a Technician</option>
      <option value="all">Display All</option>
    `;
    uniqueTechs.forEach(tech => {
      const option = document.createElement('option');
      option.value = tech;
      option.innerText = tech;
      techDropdown.appendChild(option);
    });
    techDropdown.value = previouslySelectedTech;
  }

  async function populateTechDropdown() {
    const cachedTechnicians = JSON.parse(localStorage.getItem('technicians'));
    let technicians = [];
    if (cachedTechnicians && cachedTechnicians.length > 0) {
      populateTechDropdownFromCache(cachedTechnicians);
    }
    if (!cachedTechnicians || !lastTechFetch || currentTime - lastTechFetch > cacheTime) {
      technicians = await fetchTechniciansWithRecords();
      localStorage.setItem('technicians', JSON.stringify(technicians));
      localStorage.setItem('lastTechFetchTime', currentTime.toString());
      populateTechDropdownFromCache(technicians);
    }
  }

  // --- Branch dropdown population and dedupe (NEW) ---
  async function fetchBranchesWithRecords() {
    offset = '';
    branchesWithRecords = new Set();

    try {
      do {
        const response = await axios.get(`${airtableEndpoint}`, {
          params: {
            offset: offset,
            fields: ['static Vanir Office', 'Field Tech Confirmed Job Complete']
          }
        });

        const pageRecords = response.data.records;

        pageRecords.forEach(record => {
          const branch = record.fields['static Vanir Office'];
          const isJobComplete = record.fields['Field Tech Confirmed Job Complete'];

          // include branches that still have incomplete jobs
          if (branch && !isJobComplete) {
            branchesWithRecords.add(branch);
          }
        });

        offset = response.data.offset || '';
      } while (offset);

      const result = Array.from(branchesWithRecords).sort();
      return result;

    } catch (error) {
      console.error('❌ Error fetching branches:', error);
      return [];
    }
  }

  function populateBranchDropdownFromCache(branches) {
    const uniqueBranches = Array.from(new Set(branches.filter(Boolean)));
    const previouslySelectedBranch = localStorage.getItem('branchFilter') || 'all';
    branchDropdown.innerHTML = `
      <option value="">Select a Branch</option>
      <option value="all">All Branches</option>
    `;
    uniqueBranches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch;
      option.innerText = branch;
      branchDropdown.appendChild(option);
    });
    branchDropdown.value = previouslySelectedBranch;
  }

  async function populateBranchDropdown() {
    const cachedBranches = JSON.parse(localStorage.getItem('branches'));
    let branches = [];
    if (cachedBranches && cachedBranches.length > 0) {
      populateBranchDropdownFromCache(cachedBranches);
    }
    if (!cachedBranches || !lastBranchFetch || currentTime - lastBranchFetch > cacheTime) {
      branches = await fetchBranchesWithRecords();
      localStorage.setItem('branches', JSON.stringify(branches));
      localStorage.setItem('lastBranchFetchTime', currentTime.toString());
      populateBranchDropdownFromCache(branches);
    }
  }

  // --- Fetch all incomplete records (kept for backwards calls) ---
  async function fetchAllIncompleteRecords() {
    return fetchRecordsFiltered('all', 'all');
  }

  // --- Generic fetch for combined filters (tech + branch) ---
  async function fetchRecordsFiltered(fieldTech, branch) {
    showLoadingOverlay();
    records = [];
    fetchedRecords = 0;
    offset = '';
    totalIncompleteRecords = 0;
    isFetching = true;

    renderTableFromRecords();

    try {
      // Build Airtable filterByFormula
      const formulaParts = ['NOT({Field Tech Confirmed Job Complete})'];

      if (fieldTech && fieldTech !== 'all') {
        // Using SEARCH allows partial matching and avoids quotes in names causing exact-match issues
        formulaParts.push(`SEARCH("${fieldTech.replace(/"/g, '\\"')}", {static Field Technician})`);
      }
      if (branch && branch !== 'all') {
        // Exact match on branch
        formulaParts.push(`{static Vanir Office} = "${branch.replace(/"/g, '\\"')}"`);
      }

      const filterByFormula =
        formulaParts.length > 1 ? `AND(${formulaParts.join(',')})` : formulaParts[0];

      do {
        const response = await axios.get(
          `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`,
          {
            headers: { Authorization: `Bearer ${airtableApiKey}` },
            params: {
              filterByFormula,
              view: airtableViewId,
              fields: fieldsToFetch,
              offset: offset
            }
          }
        );

        const pageRecords = response.data.records
          .filter(record => !record.fields['Field Tech Confirmed Job Complete'])
          .map(record => ({
            id: record.id,
            fields: record.fields,
            descriptionOfWork: record.fields['Description of Work']
          }));

        records = records.concat(pageRecords);
        fetchedRecords += pageRecords.length;
        totalIncompleteRecords = records.length;
        offset = response.data.offset || '';

        renderTableFromRecords();
      } while (offset);

    } catch (error) {
      console.error('❌ Error fetching records:', error);
    } finally {
      isFetching = false;
      hideLoadingOverlay();
      renderTableFromRecords();
      toggleSearchBarVisibility(records.length);
      hideColumnsIfFiltered();
    }
  }

  // --- Fetch records for a specific tech (kept, but now delegates to combined filter) ---
  async function fetchRecordsForTech(fieldTech) {
    const branch = branchDropdown.value || 'all';
    return fetchRecordsFiltered(fieldTech || 'all', branch);
  }

  function renderTableFromRecords() {
    const recordsContainer = document.getElementById('records');
    let filteredRecords = records;

    if (currentSearchTerm) {
      filteredRecords = records.filter(record =>
        Object.values(record.fields).some(val =>
          (val + '').toLowerCase().includes(currentSearchTerm)
        ) ||
        (record.descriptionOfWork || '').toLowerCase().includes(currentSearchTerm)
      );
    }

    if (filteredRecords.length === 0) {
      let warning = document.getElementById('search-warning');
      if (!warning) {
        warning = document.createElement('div');
        warning.id = 'search-warning';
        warning.style.color = 'orange';
        warning.style.margin = '1em 0';
        searchBar.parentNode.insertBefore(warning, searchBar.nextSibling);
      }
      if (isFetching) {
        warning.innerText = 'No matching records found so far. Still loading more—please try again shortly.';
        warning.style.display = '';
      } else {
        warning.innerText = 'No matching records.';
        warning.style.display = '';
      }
      recordsContainer.innerHTML = '';
      return;
    } else {
      const warning = document.getElementById('search-warning');
      if (warning) warning.style.display = 'none';
    }

    filteredRecords = sortRecordsWithSpecialCondition(filteredRecords);
    const tableHeader = `
      <thead>
        <tr>
          <th style="width: 8%;">ID Number</th>
          <th>Branch</th>
          <th>Job Name</th>
          <th>Description of Work</th>
          <th>Field Technician</th>
          <th style="width: 13%;">Completed</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    recordsContainer.innerHTML = tableHeader;
    const tableBody = recordsContainer.querySelector('tbody');

    filteredRecords.forEach((record) => {
      const recordRow = createRecordRow(record);
      tableBody.appendChild(recordRow);
    });
  }

  function sortRecordsWithSpecialCondition(records) {
    return records.sort((a, b) => {
      const branchA = a.fields['static Vanir Office'] || '';
      const branchB = b.fields['static Vanir Office'] || '';

      // First sort by branch alphabetically
      const branchCompare = branchA.localeCompare(branchB);
      if (branchCompare !== 0) return branchCompare;

      // Then sort by numeric ID inside each branch
      const idA = a.fields['ID Number'] || '';
      const idB = b.fields['ID Number'] || '';
      const numA = parseInt(idA, 10);
      const numB = parseInt(idB, 10);

      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return idA.localeCompare(idB);
    });
  }

  function createRecordRow(record) {
    const recordRow = document.createElement('tr');

    const IDNumber = record.fields['ID Number'] || '';
    const vanirOffice = record.fields['static Vanir Office'] || '';
    const jobName = record.fields['Job Name'] || '';
    const descriptionOfWork = record.fields['Description of Work'] || '';
    const fieldTechnician = record.fields['static Field Technician'] || '';
    const fieldTechConfirmedComplete = record.fields['Field Tech Confirmed Job Complete'];

    const checkboxValue = fieldTechConfirmedComplete ? 'checked' : '';

    recordRow.innerHTML = `
      <td>${IDNumber}</td>
      <td>${vanirOffice}</td>
      <td>${jobName}</td>
      <td>${descriptionOfWork}</td>
      <td>${fieldTechnician}</td>
      <td class="completed-cell">
        <label class="custom-checkbox">
          <input 
            type="checkbox" 
            ${checkboxValue} 
            data-record-id="${record.id}" 
            data-initial-checked="${checkboxValue}">
          <span class="checkmark"></span>
        </label>
      </td>
    `;

    const completedCell = recordRow.querySelector('.completed-cell');
    const checkbox = completedCell.querySelector('input[type="checkbox"]');

    checkbox.addEventListener('click', handleCheckboxClick);

    completedCell.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() !== 'input') {
        checkbox.click();
      }
    });
    return recordRow;
  }

  // --- Hide field tech/branch column depending on filters ---
  function hideColumnsIfFiltered() {
    const selectedTech = techDropdown.value || 'all';
    const selectedBranch = branchDropdown.value || 'all';

    const branchHeader = document.querySelector('th:nth-child(2)');
    const fieldTechHeader = document.querySelector('th:nth-child(5)');
    const branchCells = document.querySelectorAll('td:nth-child(2)');
    const fieldTechCells = document.querySelectorAll('td:nth-child(5)');

    if (branchHeader) {
      if (selectedBranch !== 'all' && selectedBranch) {
        branchHeader.style.display = 'none';
        branchCells.forEach(cell => { cell.style.display = 'none'; });
      } else {
        branchHeader.style.display = '';
        branchCells.forEach(cell => { cell.style.display = ''; });
      }
    }

    if (fieldTechHeader) {
      if (selectedTech !== 'all' && selectedTech) {
        fieldTechHeader.style.display = 'none';
        fieldTechCells.forEach(cell => { cell.style.display = 'none'; });
      } else {
        fieldTechHeader.style.display = '';
        fieldTechCells.forEach(cell => { cell.style.display = ''; });
      }
    }
  }

  // --- Checkbox/modal logic ---
  const modal = document.getElementById('modal');
  const yesButton = document.getElementById('yesButton');
  const noButton = document.getElementById('noButton');

  function handleCheckboxClick(event) {
    currentCheckbox = event.target;
    currentRecordId = currentCheckbox.getAttribute('data-record-id');
    const isChecked = currentCheckbox.checked;

    if (!isChecked) {
      // Unchecking: update immediately
      submitUpdate(currentRecordId, false);
      modal.style.display = 'none';
    } else {
      // Checking: always confirm
      modal.style.display = 'block';
    }
    currentCheckbox.setAttribute('data-initial-checked', isChecked);
  }

  // Yes button → confirm and update Airtable
  yesButton.addEventListener('click', () => {
    submitUpdate(currentRecordId, true);

    const recordRow = document.querySelector(`input[data-record-id="${currentRecordId}"]`)?.closest("tr");
    const jobName = recordRow ? recordRow.querySelector("td:nth-child(3)")?.textContent : `Record ${currentRecordId}`;
    showToast(`✅ Completed: ${jobName}`);

    modal.style.display = 'none';
  });

  // No button → cancel check and revert UI
  noButton.addEventListener('click', () => {
    if (currentCheckbox) currentCheckbox.checked = false;
    modal.style.display = 'none';
  });

  async function submitUpdate(recordId, isChecked) {
    try {
      await axios.patch(
        `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}/${recordId}`,
        {
          fields: {
            "Field Tech Confirmed Job Complete": isChecked
          }
        },
        {
          headers: {
            Authorization: `Bearer ${airtableApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      updateCheckboxUI(recordId, isChecked);

      if (isChecked) {
        const row = document.querySelector(`input[data-record-id="${recordId}"]`)?.closest("tr");
        if (row) {
          row.style.transition = "opacity 0.4s";
          row.style.opacity = "0";
          setTimeout(() => row.remove(), 400);
        }
      }

    } catch (error) {
      console.error('❌ Error updating record:', error);
      const checkbox = document.querySelector(`input[data-record-id="${recordId}"]`);
      if (checkbox) checkbox.checked = !isChecked;
    }
  }

  function updateCheckboxUI(recordId, isChecked) {
    const checkbox = document.querySelector(`input[data-record-id="${recordId}"]`);
    if (checkbox) {
      checkbox.checked = isChecked;
      const row = checkbox.closest('tr');
      const statusCell = row.querySelector('.status-cell');
      if (statusCell) {
        statusCell.textContent = isChecked ? 'Complete' : 'Incomplete';
      }
    }
  }

  // --- Dropdown change listeners (Tech + Branch) ---
  techDropdown.addEventListener('change', async () => {
    const selectedTech = techDropdown.value || 'all';
    localStorage.setItem('fieldTech', selectedTech);

    const selectedBranch = branchDropdown.value || 'all';
    displayNameElement.innerText =
      selectedTech !== "all" && selectedTech
        ? `Logged in as: ${selectedTech}`
        : '';

    await fetchRecordsFiltered(selectedTech, selectedBranch);
    hideColumnsIfFiltered();
  });

  branchDropdown.addEventListener('change', async () => {
    const selectedBranch = branchDropdown.value || 'all';
    localStorage.setItem('branchFilter', selectedBranch);

    const selectedTech = techDropdown.value || 'all';
    await fetchRecordsFiltered(selectedTech, selectedBranch);
    hideColumnsIfFiltered();
  });

  showLoadingOverlay();

  // --- Page load: populate both dropdowns, then fetch once with saved filters ---
  await Promise.all([populateTechDropdown(), populateBranchDropdown()]);

  const storedTech = localStorage.getItem('fieldTech') || 'all';
  const storedBranch = localStorage.getItem('branchFilter') || 'all';

  // ensure dropdowns reflect storage (in case only cache branch or tech existed)
  techDropdown.value = storedTech;
  branchDropdown.value = storedBranch;

  displayNameElement.innerText =
    storedTech !== "all" && storedTech ? `Logged in as: ${storedTech}` : '';

  await fetchRecordsFiltered(storedTech, storedBranch);
  hideColumnsIfFiltered();
});

// --- Toast ---
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show";
  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}
