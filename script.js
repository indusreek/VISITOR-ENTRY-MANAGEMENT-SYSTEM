/* =====================================================
   VISITOR MANAGEMENT SYSTEM
   FRONTEND JAVASCRIPT
===================================================== */


/* =========================
   SAMPLE / MOCK DATA
========================= */

let visitors = [

    {
        id: 1,
        name: "Arun Kumar",
        phone: "9876543210",
        purpose: "Meeting",
        date: "2026-09-01",
        checkIn: "09:15 AM",
        checkOut: "10:30 AM"
    },

    {
        id: 2,
        name: "Priya Sharma",
        phone: "9876501234",
        purpose: "Admission Enquiry",
        date: "2026-09-01",
        checkIn: "10:00 AM",
        checkOut: "-"
    },

    {
        id: 3,
        name: "Ravi Kumar",
        phone: "9843215678",
        purpose: "Document Submission",
        date: "2026-09-01",
        checkIn: "10:45 AM",
        checkOut: "11:30 AM"
    },

    {
        id: 4,
        name: "Meena Raj",
        phone: "9988776655",
        purpose: "Meeting",
        date: "2026-09-01",
        checkIn: "11:15 AM",
        checkOut: "12:10 PM"
    },

    {
        id: 5,
        name: "Karthik S",
        phone: "9123456780",
        purpose: "Enquiry",
        date: "2026-08-31",
        checkIn: "02:00 PM",
        checkOut: "02:40 PM"
    },

    {
        id: 6,
        name: "Divya M",
        phone: "9012345678",
        purpose: "Meeting",
        date: "2026-08-31",
        checkIn: "03:20 PM",
        checkOut: "04:15 PM"
    }

];


/* =========================
   NAVIGATION
========================= */

const navItems =
    document.querySelectorAll(".nav-item");

const sections =
    document.querySelectorAll(".page-section");


function showSection(sectionId) {

    sections.forEach(section => {

        section.classList.remove("active");

    });


    navItems.forEach(item => {

        item.classList.remove("active");

    });


    const selectedSection =
        document.getElementById(sectionId);


    const selectedNav =
        document.querySelector(
            `.nav-item[data-section="${sectionId}"]`
        );


    if (selectedSection) {

        selectedSection.classList.add("active");

    }


    if (selectedNav) {

        selectedNav.classList.add("active");

    }


    closeMobileMenu();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* Sidebar navigation */

navItems.forEach(item => {

    item.addEventListener(
        "click",
        function () {

            const sectionId =
                this.getAttribute("data-section");

            showSection(sectionId);

        }
    );

});


/* Buttons that navigate */

document.querySelectorAll("[data-go]")
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                const sectionId =
                    this.getAttribute("data-go");

                showSection(sectionId);

            }
        );

    });


/* =========================
   STATUS
========================= */

function getStatus(visitor) {

    if (visitor.checkOut === "-") {

        return `
            <span class="status in">
                Checked In
            </span>
        `;

    }


    return `
        <span class="status out">
            Checked Out
        </span>
    `;

}


/* =========================
   DASHBOARD TABLE
========================= */

function renderDashboard() {

    const table =
        document.getElementById("dashboardTable");


    table.innerHTML = "";


    const recentVisitors =
        visitors.slice(0, 5);


    recentVisitors.forEach(visitor => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>${visitor.name}</td>

            <td>${visitor.purpose}</td>

            <td>${visitor.date}</td>

            <td>${visitor.checkIn}</td>

            <td>${visitor.checkOut}</td>

            <td>${getStatus(visitor)}</td>

        `;


        table.appendChild(row);

    });

}


/* =========================
   RECORDS TABLE
========================= */

function renderRecords(data = visitors) {

    const table =
        document.getElementById("recordsTable");


    table.innerHTML = "";


    if (data.length === 0) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-state">

                    No visitor records found.

                </td>

            </tr>

        `;

        return;

    }


    data.forEach(visitor => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>${visitor.name}</td>

            <td>${visitor.phone}</td>

            <td>${visitor.purpose}</td>

            <td>${visitor.date}</td>

            <td>${visitor.checkIn}</td>

            <td>${visitor.checkOut}</td>

            <td>

                <div class="action-buttons">

                    <button
                        class="action-button edit-button"
                        onclick="updateVisitor(${visitor.id})">

                        Update

                    </button>


                    <button
                        class="action-button delete-button"
                        onclick="deleteVisitor(${visitor.id})">

                        Delete

                    </button>

                </div>

            </td>

        `;


        table.appendChild(row);

    });

}


/* =========================
   VISITOR LOG
========================= */

function renderLog() {

    const table =
        document.getElementById("logTable");


    table.innerHTML = "";


    visitors.forEach(visitor => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>${visitor.name}</td>

            <td>${visitor.date}</td>

            <td>${visitor.checkIn}</td>

            <td>${visitor.checkOut}</td>

            <td>${getStatus(visitor)}</td>

        `;


        table.appendChild(row);

    });

}


/* =========================
   SUMMARY
========================= */

function updateSummary() {

    const total =
        visitors.length;


    const checkedIn =
        visitors.filter(
            visitor =>
                visitor.checkOut === "-"
        ).length;


    const checkedOut =
        visitors.filter(
            visitor =>
                visitor.checkOut !== "-"
        ).length;


    const todayVisitors =
        visitors.filter(
            visitor =>
                visitor.date === "2026-09-01"
        ).length;


    document.getElementById(
        "totalVisitors"
    ).textContent = total;


    document.getElementById(
        "checkedIn"
    ).textContent = checkedIn;


    document.getElementById(
        "checkedOut"
    ).textContent = checkedOut;


    document.getElementById(
        "todayVisitors"
    ).textContent = todayVisitors;

}


/* =========================
   REGISTER VISITOR
========================= */

const visitorForm =
    document.getElementById("visitorForm");


visitorForm.addEventListener(
    "submit",
    function(event) {

        event.preventDefault();


        const name =
            document.getElementById(
                "visitorName"
            ).value.trim();


        const phone =
            document.getElementById(
                "phone"
            ).value.trim();


        const purpose =
            document.getElementById(
                "purpose"
            ).value.trim();


        const date =
            document.getElementById(
                "date"
            ).value;


        const newVisitor = {

            id: Date.now(),

            name: name,

            phone: phone,

            purpose: purpose,

            date: date,

            checkIn: "-",

            checkOut: "-"

        };


        visitors.unshift(
            newVisitor
        );


        visitorForm.reset();


        renderAll();


        showSection("records");

    }
);


/* =========================
   UPDATE VISITOR
========================= */

function updateVisitor(id) {

    const visitor =
        visitors.find(
            item => item.id === id
        );


    if (!visitor) {

        return;

    }


    const newName =
        prompt(
            "Enter updated visitor name:",
            visitor.name
        );


    if (newName === null) {

        return;

    }


    const newPhone =
        prompt(
            "Enter updated contact number:",
            visitor.phone
        );


    if (newPhone === null) {

        return;

    }


    const newPurpose =
        prompt(
            "Enter updated purpose:",
            visitor.purpose
        );


    if (newPurpose === null) {

        return;

    }


    visitor.name =
        newName.trim();


    visitor.phone =
        newPhone.trim();


    visitor.purpose =
        newPurpose.trim();


    renderAll();

}


/* =========================
   DELETE VISITOR
========================= */

function deleteVisitor(id) {

    const visitor =
        visitors.find(
            item => item.id === id
        );


    if (!visitor) {

        return;

    }


    const confirmation =
        confirm(
            `Delete the visitor record for ${visitor.name}?`
        );


    if (!confirmation) {

        return;

    }


    visitors =
        visitors.filter(
            item => item.id !== id
        );


    renderAll();

}


/* =========================
   RECORD SEARCH
========================= */

const recordSearch =
    document.getElementById(
        "recordSearch"
    );


recordSearch.addEventListener(
    "input",
    function() {

        const searchText =
            this.value
                .toLowerCase()
                .trim();


        const filteredVisitors =
            visitors.filter(visitor => {

                return (

                    visitor.name
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    visitor.phone
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    visitor.purpose
                        .toLowerCase()
                        .includes(searchText)

                );

            });


        renderRecords(
            filteredVisitors
        );

    }
);


/* =========================
   MAIN SEARCH
========================= */

const mainSearch =
    document.getElementById(
        "mainSearch"
    );


const searchButton =
    document.getElementById(
        "searchButton"
    );


function performSearch() {

    const searchText =
        mainSearch.value
            .toLowerCase()
            .trim();


    const table =
        document.getElementById(
            "searchTable"
        );


    const resultText =
        document.getElementById(
            "searchResultText"
        );


    table.innerHTML = "";


    if (searchText === "") {

        resultText.textContent =
            "Enter a search term to find visitor records.";

        return;

    }


    const results =
        visitors.filter(visitor => {

            return (

                visitor.name
                    .toLowerCase()
                    .includes(searchText)

                ||

                visitor.phone
                    .toLowerCase()
                    .includes(searchText)

                ||

                visitor.purpose
                    .toLowerCase()
                    .includes(searchText)

            );

        });


    resultText.textContent =
        `${results.length} visitor record(s) found.`;


    if (results.length === 0) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-state">

                    No matching visitor records found.

                </td>

            </tr>

        `;

        return;

    }


    results.forEach(visitor => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>${visitor.name}</td>

            <td>${visitor.phone}</td>

            <td>${visitor.purpose}</td>

            <td>${visitor.date}</td>

            <td>${visitor.checkIn}</td>

            <td>${visitor.checkOut}</td>

        `;


        table.appendChild(row);

    });

}


searchButton.addEventListener(
    "click",
    performSearch
);


mainSearch.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {

            performSearch();

        }

    }
);


/* =========================
   MOBILE SIDEBAR
========================= */

const menuButton =
    document.getElementById(
        "menuButton"
    );


const sidebar =
    document.getElementById(
        "sidebar"
    );


const overlay =
    document.getElementById(
        "overlay"
    );


menuButton.addEventListener(
    "click",
    function() {

        sidebar.classList.toggle("open");

        overlay.classList.toggle("show");

    }
);


overlay.addEventListener(
    "click",
    closeMobileMenu
);


function closeMobileMenu() {

    sidebar.classList.remove("open");

    overlay.classList.remove("show");

}


/* =========================
   INITIAL RENDER
========================= */

function renderAll() {

    renderDashboard();

    renderRecords();

    renderLog();

    updateSummary();

}


renderAll();