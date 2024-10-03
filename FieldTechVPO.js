document.addEventListener("DOMContentLoaded", async function () {
    console.log('DOM fully loaded and parsed');

    const storedTech = localStorage.getItem('fieldTech');
    const displayNameElement = document.getElementById('displayName');
    const techDropdown = document.getElementById('techDropdown'); // Get the dropdown element
    const searchBar = document.getElementById('searchBar'); // Reference to the search bar
    const loadingBar = document.getElementById('loadingBar'); // Reference to the loading bar element
    const airtableApiKey = 'pata9Iv7DANqtJrgO.b308b33cd0f323601f3fb580aac0d333ca1629dd26c5ebe2e2b9f18143ccaa8e';
    const airtableBaseId = 'appQDdkj6ydqUaUkE';
    const airtableTableName = 'tblO72Aw6qplOEAhR';
    const airtableEndpoint = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;

    axios.defaults.headers.common['Authorization'] = `Bearer ${airtableApiKey}`;

    let technicianRecords = []; // Store records fetched for the logged-in technician

    const cacheTime = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    const lastFetch = localStorage.getItem('lastTechFetchTime');
    const currentTime = new Date().getTime();

    // Function to hide search bar if less than 6 records
    function toggleSearchBarVisibility(records) {
        if (records.length < 6) {
            searchBar.style.display = 'none';  // Hide the search bar if there are less than 6 records
        } else {
            searchBar.style.display = 'block';  // Show the search bar if there are 6 or more records
        }
    }

    let loadingBarTimeout; // To store the timeout reference
    let loadingStartTime;  // To track when loading started
    
    // Show the loading bar after a 3-second delay
    function showLoadingBar() {
        loadingStartTime = Date.now();
        loadingBarTimeout = setTimeout(() => {
            const loadingBarContainer = document.getElementById('loadingBarContainer');
            loadingBarContainer.style.display = 'block'; // Show the loading bar
            console.log("Loading bar displayed after 3 seconds");
        }, 3000); // Delay for 3 seconds
    }

    // Function to handle search input and filter table rows
function filterTable() {
    const searchTerm = searchBar.value.toLowerCase(); // Get the search term and convert to lowercase
    const recordsTable = document.querySelector('#records'); // Correct selector
    const rows = recordsTable.getElementsByTagName('tr'); // Get all rows of the table

    // Loop through all rows except the first one (which is the table header)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        let rowContainsTerm = false; // Flag to check if the row contains the search term

        // Loop through each cell in the row
        const cells = row.getElementsByTagName('td');
        for (let j = 0; j < cells.length; j++) {
            const cellText = cells[j].textContent.toLowerCase(); // Get the cell's text and convert to lowercase
            if (cellText.includes(searchTerm)) { // Check if cell contains the search term
                rowContainsTerm = true; // Set flag to true if term is found
                break; // Exit the loop since we only need one match per row
            }
        }

        // Show or hide the row based on whether it contains the search term
        row.style.display = rowContainsTerm ? '' : 'none';
    }
}

// Add an event listener for the search bar input event
searchBar.addEventListener('input', filterTable);

    
    // Hide the loading bar immediately when loading is complete
    function hideLoadingBar() {
        const loadingBarContainer = document.getElementById('loadingBarContainer');
        
        // Check if loading finished in less than 3 seconds
        const elapsedTime = Date.now() - loadingStartTime;
        if (elapsedTime < 3000) {
            console.log("Loading completed in less than 3 seconds, not showing the loading bar.");
            clearTimeout(loadingBarTimeout); // Cancel showing the loading bar if loading finishes quickly
        } else {
            loadingBarContainer.style.display = 'none'; // Hide if the bar was shown
            console.log("Loading bar hidden.");
        }
    }
    
    // Update the loading bar based on progress
    function updateLoadingBar(current, total) {
        const loadingBar = document.getElementById('loadingBar');
        const loadingPercentage = document.getElementById('loadingPercentage');
        
        const percentage = Math.min(Math.round((current / total) * 100), 100); // Calculate percentage
        loadingBar.style.width = `${percentage}%`;  // Update bar width
        loadingPercentage.innerText = `${percentage}%`;  // Update percentage text
        
        console.log(`Loading bar updated: ${percentage}% (${current} of ${total} records fetched).`);
    }
    
    async function fetchAndDisplayRecords() {
        const recordsTableBody = document.querySelector('#recordsTable tbody');
        recordsTableBody.innerHTML = ''; // Clear any existing records
    
        try {
            console.log("Starting to fetch records from Airtable...");
            showLoadingBar();
    
            let totalRecords = 0;
            let fetchedRecords = 0;
            let records = [];
            let offset = '';
    
            // First pass: Fetch all records to get the total count
            console.log("Calculating total number of records...");
            do {
                const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
                const pageRecords = response.data.records;
                records = records.concat(pageRecords);
                totalRecords += pageRecords.length; // Count the total records
                offset = response.data.offset || ''; // Move to the next page of results
            } while (offset);
    
            console.log(`Total records to fetch: ${totalRecords}`);
    
            // Second pass: Fetch records and update the percentage
            offset = ''; // Reset offset to start fetching records again
            fetchedRecords = 0; // Reset fetched records count
            records = []; // Clear previously fetched records
    
            do {
                const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
                const pageRecords = response.data.records;
                records = records.concat(pageRecords);
                fetchedRecords += pageRecords.length;
    
                // Update loading bar
                updateLoadingBar(fetchedRecords, totalRecords);
    
                offset = response.data.offset || ''; // Move to the next page of results
                console.log(`Fetched ${fetchedRecords} records so far.`);
            } while (offset);
    
            // Hide the loading bar once fetching is complete
            hideLoadingBar();
            console.log("Finished fetching all records.");
    
            // Populate the table with the fetched records
            console.log("Populating the table with fetched records...");
            records.forEach(record => {
                const recordRow = document.createElement('tr');
                recordRow.innerHTML = `
                    <td>${record.fields['ID Number'] || ''}</td>
                    <td>${record.fields['static Vanir Office'] || ''}</td>
                    <td>${record.fields['Job Name'] || ''}</td>
                    <td>${record.fields['Description of Work'] || ''}</td>
                    <td>${record.fields['static Field Technician'] || ''}</td>
                    <td>${record.fields['Field Tech Confirmed Job Complete'] ? 'Yes' : 'No'}</td>
                `;
                recordsTableBody.appendChild(recordRow);
            });
    
            console.log(`Total number of records displayed: ${records.length}`);
        } catch (error) {
            console.error('Error fetching records:', error);
            hideLoadingBar(); // Hide the loading bar in case of error
        }
    }
    

// Trigger fetching when the page loads or on some event
document.addEventListener("DOMContentLoaded", async function () {
    console.log("DOM fully loaded, triggering record fetch...");
    await fetchAndDisplayRecords(); // Trigger the fetch when the page loads
});



    // Fetch unique technician names with at least one incomplete record from Airtable
    async function fetchTechniciansWithRecords() {
        try {
            let techniciansWithRecords = new Set(); // Use a Set to ensure uniqueness
            let offset = '';

            // Fetch all records
            do {
                const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
                const records = response.data.records;

                // Process each record and add the technician name if they have a record
                records.forEach(record => {
                    const techName = record.fields['static Field Technician'];
                    const isJobComplete = record.fields['Field Tech Confirmed Job Complete'];
                    if (techName && !isJobComplete) {  // Only include technicians with incomplete jobs
                        techniciansWithRecords.add(techName); // Add technician name to the Set
                    }
                });

                offset = response.data.offset || ''; // Move to the next page of results
            } while (offset);

            return Array.from(techniciansWithRecords).sort(); // Convert the Set to an Array and sort alphabetically
        } catch (error) {
            console.error('Error fetching technicians:', error);
            return [];
        }
    }

    async function populateDropdown() {
        const cachedTechnicians = JSON.parse(localStorage.getItem('technicians'));
        
        // Show loading message in the dropdown
        techDropdown.innerHTML = '<option value="">Loading technicians...</option>';
        
        // If cached technicians exist, load them into the dropdown first
        if (cachedTechnicians && cachedTechnicians.length > 0) {
            populateDropdownFromCache(cachedTechnicians);
            console.log('Dropdown populated from cache');
        } else {
            // No cache available, proceed with fetching and notify user
            console.log('No cached data, fetching technician names from Airtable...');
        }
    
        // Check cache expiration or if no cache is available
        if (!cachedTechnicians || !lastFetch || currentTime - lastFetch > cacheTime) {
            try {
                // Immediately fetch fresh technician names from Airtable if the cache is empty or expired
                const technicians = await fetchTechniciansWithRecords();
    
                // If no technicians were fetched, fetch all incomplete records
                if (technicians.length === 0) {
                    console.log("No technicians found, loading all records...");
                    fetchAllIncompleteRecords(); // Fetch all records if no technicians are available
                    return; // Stop further processing
                }
    
                localStorage.setItem('technicians', JSON.stringify(technicians));
                localStorage.setItem('lastTechFetchTime', currentTime.toString());
    
                // Update dropdown after fetching new data
                populateDropdownFromCache(technicians);
                console.log('Dropdown updated with fresh data');
            } catch (error) {
                console.error('Error fetching technicians:', error);
                // Handle error by showing all records if technician names cannot be loaded
                fetchAllIncompleteRecords(); // Fetch all records by default if an error occurs
            }
        }
    }
    
    
    function populateDropdownFromCache(technicians) {
        const previouslySelectedTech = localStorage.getItem('fieldTech') || '';
    
        techDropdown.innerHTML = `
            <option value="">Select a Technician</option>
            <option value="all">Display All</option>
        `;
    
        technicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.innerText = tech;
            techDropdown.appendChild(option);
        });
    
        // Set the dropdown to the previously selected technician
        if (previouslySelectedTech) {
            techDropdown.value = previouslySelectedTech;
        }
    }
    
 // Call populateDropdown immediately when DOM is ready
document.addEventListener("DOMContentLoaded", async function () {
    console.log("DOM fully loaded, populating dropdown...");
    await populateDropdown();
    
    // Fetch all records if no technician is selected or no data is loaded in dropdown
    if (!techDropdown.value || techDropdown.value === "") {
        console.log("No technician selected, loading all records...");
        fetchAllIncompleteRecords(); // Fetch all incomplete records by default
    }
    });
    
    // Define the fetchAllIncompleteRecords function
async function fetchAllIncompleteRecords() {
    try {
        showLoadingBar();
        console.log(`Fetching all incomplete records from Airtable...`);

        let records = [];
        let fetchedRecords = 0;
        let totalIncompleteRecords = 0;
        let offset = '';

        // Step 1: Calculate total number of incomplete records
// Step 1: Calculate total number of incomplete records
console.log("Calculating total number of incomplete records...");
do {
    const response = await axios.get(`${airtableEndpoint}?filterByFormula=AND(NOT({Field Tech Confirmed Job Complete}), {VPO Status} = 'Awaiting Field Tech Complete Confirmation')&offset=${offset}`);
    const incompleteRecords = response.data.records.filter(record => !record.fields['Field Tech Confirmed Job Complete']);
    totalIncompleteRecords += incompleteRecords.length; // Count only incomplete records
    offset = response.data.offset || ''; // Move to the next page of results
} while (offset);

console.log(`Total incomplete records to fetch: ${totalIncompleteRecords}`);

// Step 2: Fetch incomplete records and update the percentage
offset = ''; // Reset the offset to fetch records again
do {
    const response = await axios.get(`${airtableEndpoint}?filterByFormula=AND(NOT({Field Tech Confirmed Job Complete}), {VPO Status} = 'Awaiting Field Tech Complete Confirmation')&offset=${offset}`);
    const pageRecords = response.data.records.filter(record => !record.fields['Field Tech Confirmed Job Complete'])
        .map(record => ({
            id: record.id,
            fields: record.fields,
            descriptionOfWork: record.fields['Description of Work']
        }));
    records = records.concat(pageRecords);
    fetchedRecords += pageRecords.length;

    // Update the loading bar based on how many records have been fetched
    updateLoadingBar(fetchedRecords, totalIncompleteRecords);

    offset = response.data.offset || ''; // Move to the next page of results
} while (offset);

toggleSearchBarVisibility(records); // Hide search bar if fewer than 6 records
displayRecordsWithFadeIn(records); // Display all incomplete records with fade-in effect
console.log(`Fetched ${records.length} incomplete records.`);

} catch (error) {
    console.error('Error fetching all incomplete records:', error);
} finally {
    hideLoadingBar(); // Hide the loading bar after fetching is complete
}

}




    // Fetch records for a selected technician
    async function fetchRecordsForTech(fieldTech) {
        try {
            showLoadingBar();
            console.log(`Fetching records for ${fieldTech} from Airtable...`);
    
            let records = [];
            let fetchedRecords = 0;
            let totalIncompleteRecords = 0;
            let offset = '';
    
            // Step 1: Calculate total number of incomplete records for the selected technician
            console.log(`Calculating total number of incomplete records for ${fieldTech}...`);
            const filterByFormula = `SEARCH("${fieldTech}", {static Field Technician})`;
            do {
                const response = await axios.get(`${airtableEndpoint}?filterByFormula=${encodeURIComponent(filterByFormula)}&offset=${offset}`);
                const incompleteRecords = response.data.records.filter(record => !record.fields['Field Tech Confirmed Job Complete']);
                totalIncompleteRecords += incompleteRecords.length; // Count only incomplete records
                offset = response.data.offset || ''; // Move to the next page of results
            } while (offset);
    
            console.log(`Total incomplete records for ${fieldTech}: ${totalIncompleteRecords}`);
    
            // Step 2: Fetch records and update the percentage
            offset = ''; // Reset the offset to fetch records again
            do {
                const response = await axios.get(`${airtableEndpoint}?filterByFormula=${encodeURIComponent(filterByFormula)}&offset=${offset}`);
                const pageRecords = response.data.records.filter(record => !record.fields['Field Tech Confirmed Job Complete'])
                    .map(record => ({
                        id: record.id,
                        fields: record.fields,
                        descriptionOfWork: record.fields['Description of Work']
                    }));
                records = records.concat(pageRecords);
                fetchedRecords += pageRecords.length;
    
                // Update the loading bar based on how many records have been fetched
                updateLoadingBar(fetchedRecords, totalIncompleteRecords);
    
                offset = response.data.offset || ''; // Move to the next page of results
            } while (offset);
    
            toggleSearchBarVisibility(records); // Hide search bar if fewer than 6 records
            displayRecordsWithFadeIn(records); // Display the selected technician's records with fade-in effect
            console.log(`Fetched ${records.length} incomplete records for ${fieldTech}.`);
            
            // Call hideFieldTechnicianColumnIfMatches after populating the records
            hideFieldTechnicianColumnIfMatches();
    
        } catch (error) {
            console.error(`Error fetching records for technician ${fieldTech}:`, error);
        } finally {
            hideLoadingBar(); // Hide the loading bar after fetching is complete
        }
    }
    
    // Function to display records with fade-in effect
    function displayRecordsWithFadeIn(records) {
        console.log('Displaying records...');
        const recordsContainer = document.getElementById('records');
        recordsContainer.innerHTML = '';

        if (records.length === 0) {
            recordsContainer.innerText = 'No records found.';
            return;
        }

        records = sortRecordsWithSpecialCondition(records);

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

        // Use setTimeout to create a fade-in effect for each record
        records.forEach((record, index) => {
            const recordRow = createRecordRow(record);
            recordRow.style.opacity = 0; // Initially set opacity to 0 for fade-in effect

            setTimeout(() => {
                recordRow.style.opacity = 1; // Fade-in effect
                recordRow.style.transition = 'opacity 0.5s'; // Apply CSS transition for smooth fade-in
            }, index * 100); // Delay each row by 100ms

            tableBody.appendChild(recordRow);
        });

        console.log(`Total number of entries displayed: ${records.length}`);
    }


    function sortRecordsWithSpecialCondition(records) {
        return records.sort((a, b) => {
            const idA = a.fields['ID Number'] || ''; // Fetch the ID Number field from record A
            const idB = b.fields['ID Number'] || ''; // Fetch the ID Number field from record B
    
            // If ID Numbers are numeric, compare numerically
            const numA = parseInt(idA, 10);
            const numB = parseInt(idB, 10);
    
            // If both IDs are valid numbers, sort numerically
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
    
            // If IDs are not numbers or not comparable numerically, fall back to lexicographical sort
            return idA.localeCompare(idB);
        });
    }
    

    function createRecordRow(record) {
        const recordRow = document.createElement('tr');
        const IDNumber = record.fields['ID Number'] || '';
        const vanirOffice = record.fields['static Vanir Office'] || '';
        const jobName = record.fields['Job Name'] || '';
        const fieldTechnician = record.fields['static Field Technician'] || '';
        const fieldTechConfirmedComplete = record.fields['Field Tech Confirmed Job Complete'];
        const checkboxValue = fieldTechConfirmedComplete ? 'checked' : '';
        const descriptionOfWork = record.descriptionOfWork || '';

        recordRow.innerHTML = `
            <td>${IDNumber}</td>
            <td>${vanirOffice}</td>
            <td>${jobName}</td>
            <td>${descriptionOfWork}</td>
            <td>${fieldTechnician}</td>
            <td>
                <label class="custom-checkbox">
                    <input type="checkbox" ${checkboxValue} data-record-id="${record.id}" data-initial-checked="${checkboxValue}">
                    <span class="checkmark"></span>
                </label>
            </td>
        `;

        const checkbox = recordRow.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('click', handleCheckboxClick);

        return recordRow;
    }
    const modal = document.getElementById('modal');  // Reference the modal element
    const yesButton = document.getElementById('yesButton');
    const noButton = document.getElementById('noButton');
    
    function hideFieldTechnicianColumnIfMatches() {
        const selectedTech = techDropdown.value; // Get the selected technician from the dropdown
        const rows = document.querySelectorAll('#records tbody tr'); // Get all table rows
    
        // Get the "Field Technician" and "Branch" headers and cells
        const fieldTechHeader = document.querySelector('th:nth-child(5)');
        const branchHeader = document.querySelector('th:nth-child(2)');
        const fieldTechCells = document.querySelectorAll('td:nth-child(5)');
        const branchCells = document.querySelectorAll('td:nth-child(2)');
    
        // If "all" is selected, show both "Field Technician" and "Branch" columns
        if (selectedTech === "all") {
            fieldTechHeader.style.display = ''; // Show the Field Technician header
            fieldTechCells.forEach(cell => {
                cell.style.display = ''; // Show each Field Technician cell in the column
            });
            
            branchHeader.style.display = ''; // Show the Branch header
            branchCells.forEach(cell => {
                cell.style.display = ''; // Show each Branch cell in the column
            });
        } else {
            // Hide both "Field Technician" and "Branch" columns when a specific technician is selected
            fieldTechHeader.style.display = 'none'; // Hide the Field Technician header
            fieldTechCells.forEach(cell => {
                cell.style.display = 'none'; // Hide each Field Technician cell in the column
            });
    
            branchHeader.style.display = 'none'; // Hide the Branch header
            branchCells.forEach(cell => {
                cell.style.display = 'none'; // Hide each Branch cell in the column
            });
        }
    }
    
    // Call the function when the dropdown changes
    techDropdown.addEventListener('change', hideFieldTechnicianColumnIfMatches);
    
    // Call the function on page load to hide/show the columns based on the current selection
    document.addEventListener("DOMContentLoaded", () => {
        hideFieldTechnicianColumnIfMatches();
    });
    
    
    
    
    // Call the function when the dropdown changes
    techDropdown.addEventListener('change', hideFieldTechnicianColumnIfMatches);
    let currentCheckbox = null; // Declare at a higher scope
    let currentRecordId = null;  // Declare at a higher scope
    
    // Function to handle checkbox click event
    function handleCheckboxClick(event) {
        currentCheckbox = event.target;  // Assign current checkbox globally
        currentRecordId = currentCheckbox.getAttribute('data-record-id');
        const isChecked = currentCheckbox.checked;
        const initialChecked = currentCheckbox.getAttribute('data-initial-checked') === 'true';
    
        if (!isChecked) {
            // Checkbox was unchecked: immediately submit the update without showing the modal
            console.log('Checkbox unchecked, submitting update immediately...');
            submitUpdate(currentRecordId, false); // Uncheck action, no modal
            modal.style.display = 'none'; // Hide the modal when unchecked
        } else if (!initialChecked && isChecked) {
            // Checkbox was initially unchecked and is now checked: Show the modal for confirmation
            console.log('Checkbox checked, showing modal for confirmation...');
            modal.style.display = 'block'; // Show the modal when checked
        }
    
        // Update the checkbox's 'data-initial-checked' attribute to its current state after interaction
        currentCheckbox.setAttribute('data-initial-checked', isChecked);
    }
    
    // Event listeners for modal buttons
    yesButton.addEventListener('click', () => {
        submitUpdate(currentRecordId, true);  // Use the globally declared currentRecordId
        modal.style.display = 'none';
    });
    
    noButton.addEventListener('click', () => {
        if (currentCheckbox) {
            currentCheckbox.checked = false;  // Uncheck the checkbox if "No" is clicked
        }
        modal.style.display = 'none';
    });
    

    async function submitUpdate(recordId, isChecked) {
        console.log(`Submitting update for record ID ${recordId}...`);
    
        try {
            // Send the update to Airtable
            await axios.patch(`${airtableEndpoint}/${recordId}`, {
                fields: {
                    'Field Tech Confirmed Job Complete': isChecked,
                    'Field Tech Confirmed Job Completed Date': isChecked ? new Date().toISOString() : null
                }
            });
    
            if (isChecked) {
                // Only show alert if the job is confirmed complete (checked)
                console.log(`Record ID ${recordId} marked as complete.`);
                alert(`Record ID ${recordId} updated successfully.`);
            } else {
                // Log for uncheck, no alert needed
                console.log(`Record ID ${recordId} marked as incomplete.`);
            }
    
            // Dynamically update the UI instead of reloading
            updateCheckboxUI(recordId, isChecked);
    
            // Add page refresh after successful submission
            location.reload();
    
        } catch (error) {
            console.error('Error updating record:', error);
        }
    }
    
    
    function updateCheckboxUI(recordId, isChecked) {
        // Find the checkbox element using the record ID
        const checkbox = document.querySelector(`input[data-record-id="${recordId}"]`);
    
        if (checkbox) {
            // Update the checkbox state
            checkbox.checked = isChecked;
    
            // Optionally update any other UI elements (e.g., change labels or text)
            const row = checkbox.closest('tr'); // Assuming the checkbox is inside a row
            const statusCell = row.querySelector('.status-cell'); // Assuming there's a status cell to update
            if (statusCell) {
                statusCell.textContent = isChecked ? 'Complete' : 'Incomplete';
            }
        }
    }
    

     // Handle dropdown change event
     techDropdown.addEventListener('change', () => {
        const selectedTech = techDropdown.value;
        if (selectedTech === "all") {
            fetchAllIncompleteRecords(); // Fetch and display all incomplete records
        } else if (selectedTech) {
            localStorage.setItem('fieldTech', selectedTech);
            displayNameElement.innerText = `Logged in as: ${selectedTech}`;
            fetchRecordsForTech(selectedTech); // Re-fetch records for the selected technician
        }
        hideFieldTechnicianColumnIfMatches(); // Check and hide the Field Technician column if applicable
    });
    
    // Populate dropdown with unique technician names on page load
    populateDropdown();

    // Fetch records for the logged-in technician on page load if available
    if (storedTech && storedTech !== "all") {
        fetchRecordsForTech(storedTech);
    } else if (storedTech === "all") {
        fetchAllIncompleteRecords(); // Fetch all incomplete records if "Display All" was previously selected
    }
});