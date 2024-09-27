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

    // Show the loading bar
    function showLoadingBar() {
        if (loadingBar) {
            loadingBar.style.display = 'block';
        } else {
            console.error('Loading bar element not found.');
        }
    }

    // Hide the loading bar
    function hideLoadingBar() {
        if (loadingBar) {
            loadingBar.style.display = 'none';
        } else {
            console.error('Loading bar element not found.');
        }
    }

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

    // Populate dropdown with technician names who have records
    async function populateDropdown() {
        // Check if cached technicians exist and load them first
        const cachedTechnicians = JSON.parse(localStorage.getItem('technicians'));
        
        if (cachedTechnicians) {
            // Populate dropdown from cache immediately
            populateDropdownFromCache(cachedTechnicians);
            console.log('Dropdown populated from cache');
        }
    
        // Check cache expiration or if no cache is available
        if (!lastFetch || currentTime - lastFetch > cacheTime) {
            // Fetch fresh technician names from Airtable asynchronously in the background
            setTimeout(async () => {
                const technicians = await fetchTechniciansWithRecords();
                localStorage.setItem('technicians', JSON.stringify(technicians));
                localStorage.setItem('lastTechFetchTime', currentTime.toString());
    
                // Update dropdown after fetching new data in the background
                populateDropdownFromCache(technicians);
                console.log('Dropdown updated with fresh data');
            }, 500);  // Delay fetching to allow for faster perceived load
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

    // Fetch all incomplete records (for "Display All" option)
    async function fetchAllIncompleteRecords() {
        try {
            showLoadingBar();
            console.log(`Fetching all incomplete records from Airtable...`);

            let records = [];
            let offset = '';

            do {
                const response = await axios.get(`${airtableEndpoint}?offset=${offset}`);
                records = records.concat(response.data.records.map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work']
                })));
                offset = response.data.offset || '';
            } while (offset);

            // Filter records to only show those that are not completed
            const incompleteRecords = records.filter(record => !record.fields['Field Tech Confirmed Job Complete']);
            
            toggleSearchBarVisibility(incompleteRecords); // Hide search bar if fewer than 6 records
            displayRecordsWithFadeIn(incompleteRecords); // Display all incomplete records with fade-in effect
        } catch (error) {
            console.error('Error fetching all incomplete records:', error);
        } finally {
            hideLoadingBar();
        }
    }
    // Fetch records for the selected technician
    async function fetchRecordsForTech(fieldTech) {
        try {
            showLoadingBar();
            console.log(`Fetching records for ${fieldTech} from Airtable...`);

            const filterByFormula = `SEARCH("${fieldTech}", {static Field Technician})`;
            let records = [];
            let offset = '';

            do {
                const response = await axios.get(`${airtableEndpoint}?filterByFormula=${encodeURIComponent(filterByFormula)}&offset=${offset}`);
                records = records.concat(response.data.records.map(record => ({
                    id: record.id,
                    fields: record.fields,
                    descriptionOfWork: record.fields['Description of Work']
                })));
                offset = response.data.offset || '';
            } while (offset);

            // Filter records to show only those that are not completed
            technicianRecords = records.filter(record => !record.fields['Field Tech Confirmed Job Complete']);
            
            toggleSearchBarVisibility(technicianRecords); // Hide search bar if fewer than 6 records
            displayRecordsWithFadeIn(technicianRecords); // Display the selected technician's records with fade-in
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            hideLoadingBar();
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
            const officeA = a.fields['static Vanir Office'] || '';
            const officeB = b.fields['static Vanir Office'] || '';
            const techA = a.fields['static Field Technician'] || '';
            const techB = b.fields['static Field Technician'] || '';

            if (officeA === 'Greensboro' && officeB === 'Greenville, SC') return -1;
            if (officeA === 'Greenville, SC' && officeB === 'Greensboro') return 1;

            const primarySort = officeA.localeCompare(officeB);
            if (primarySort !== 0) return primarySort;

            return techA.localeCompare(techB);
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


    function handleCheckboxClick(event) {
        currentCheckbox = event.target;
        currentRecordId = currentCheckbox.getAttribute('data-record-id');
        const isChecked = currentCheckbox.checked;
        const initialChecked = currentCheckbox.getAttribute('data-initial-checked') === 'checked';
        modal.style.display = 'block';

        if (!initialChecked && isChecked) {
            modal.style.display = 'block';
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
                    'Field Tech Confirmed Job Completed Date': new Date().toISOString()
                }
            });

            console.log(`Record ID ${recordId} updated successfully.`);
            alert(`Record ID ${recordId} updated successfully.`);
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
