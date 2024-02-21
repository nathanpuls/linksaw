document.addEventListener('DOMContentLoaded', function () {
    var database = firebase.database();
    var dataRef = database.ref('/snips');

    function displayData(data) {
        var dataDisplayDiv = document.getElementById('dataDisplay');

        if (dataDisplayDiv) {
            dataDisplayDiv.innerHTML = '';

            for (var key in data) {
                var snipName = data[key].name;
                var dataItem = document.createElement('p');
                dataItem.textContent = snipName;
                dataDisplayDiv.appendChild(dataItem);
            }
        } else {
            console.error('Element with ID "dataDisplay" not found.');
        }
    }

    dataRef.on('value', function (snapshot) {
        var data = snapshot.val();
        displayData(data);
        console.log(data);
    });
});
