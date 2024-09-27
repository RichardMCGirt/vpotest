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
    

// Fetch records from Airtable with percentage-based loading
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

        // First, get the total number of records to calculate the percentage
        const initialResponse = await axios.get(`${airtableEndpoint}?pageSize=1`);
        totalRecords = initialResponse.data.records.length; // Replace with actual total count logic if available
        console.log(`Total records to fetch: ${totalRecords}`);

        // Fetch records in pages (or batches)
        do {
            console.log(`Fetching batch of records, current offset: ${offset}`);
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
    
        // If cached technicians exist, load them into the dropdown first
        if (cachedTechnicians && cachedTechnicians.length > 0) {
            populateDropdownFromCache(cachedTechnicians);
            console.log('Dropdown populated from cache');
        }
    
        // Check cache expiration or if no cache is available
        if (!cachedTechnicians || !lastFetch || currentTime - lastFetch > cacheTime) {
            // Immediately fetch fresh technician names from Airtable if the cache is empty or expired
            const technicians = await fetchTechniciansWithRecords();
            localStorage.setItem('technicians', JSON.stringify(technicians));
            localStorage.setItem('lastTechFetchTime', currentTime.toString());
    
            // Update dropdown after fetching new data
            populateDropdownFromCache(technicians);
            console.log('Dropdown updated with fresh data');
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
    });
    

 // Fetch all incomplete records (for "Display All" option)
async function fetchAllIncompleteRecords() {
    try {
        showLoadingBar();
        console.log(`Fetching all incomplete records from Airtable...`);

        let records = [];
        let fetchedRecords = 0;
        let totalIncompleteRecords = 0;
        let offset = '';

        // Step 1: Calculate total number of incomplete records
        console.log("Calculating total number of incomplete records...");
        do {
            const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
            const incompleteRecords = response.data.records.filter(record => !record.fields['Field Tech Confirmed Job Complete']);
            totalIncompleteRecords += incompleteRecords.length; // Count only incomplete records
            offset = response.data.offset || ''; // Move to the next page of results
        } while (offset);

        console.log(`Total incomplete records to fetch: ${totalIncompleteRecords}`);

        // Step 2: Fetch incomplete records and update the percentage
        offset = ''; // Reset the offset to fetch records again
        do {
            const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
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
                    <th style="width: 13%;">Confirmed Complete</th>
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


 // Function to handle checkbox click event
 function handleCheckboxClick(event) {
    currentCheckbox = event.target;
    currentRecordId = currentCheckbox.getAttribute('data-record-id');
    const isChecked = currentCheckbox.checked;
    const initialChecked = currentCheckbox.getAttribute('data-initial-checked') === 'checked';

    if (!isChecked) {
        // Checkbox is unchecked: immediately submit the update without showing the modal or alert
        console.log('Checkbox unchecked, submitting update immediately...');
        submitUpdate(currentRecordId, false); // Uncheck action, no modal, no alert
    } else if (!initialChecked && isChecked) {
        // Checkbox is checked: show the modal for confirmation
        console.log('Checkbox checked, showing modal for confirmation...');
        modal.style.display = 'block'; // Show the modal
    }
}

    

    yesButton.addEventListener('click', () => {
        submitUpdate(currentRecordId, true);
        modal.style.display = 'none';
    });

    noButton.addEventListener('click', () => {
        currentCheckbox.checked = false;
        modal.style.display = 'none';
    });

    async function submitUpdate(recordId, isChecked) {
        console.log(`Submitting update for record ID ${recordId}...`);
    
        try {
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
            }
    
            // Reload the page to reflect changes without alert on uncheck
            location.reload();
    
        } catch (error) {
            console.error('Error updating record:', error);
            alert(`Error updating record ID ${recordId}. Please try again.`);
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
