function displayLinks() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            const username = user.email.replace(/@gmail\.com$/i, "");
            const linksRef = firebase.database().ref("users/" + username + "/links");
            var name = 'soon';

            linksRef.once("value", (snapshot) => {
                const linksList = document.getElementById("linksList");

                snapshot.forEach((childSnapshot) => {
                    const linkData = childSnapshot.val();
                    const listItem = document.createElement("p");
                    const name = linkData.name;
                

                    let url = linkData.url;
          if (
            !url.startsWith("http://") &&
            !url.startsWith("https://") &&
            !url.startsWith("www")
          ) {
            // If not, add http:// to the beginning
            url = "http://" + url;
          }

                    // Display link data as list items
                    listItem.innerHTML =
                    
                    // `<a href="${linkData.url}">${linkData.name}</a>;

                 `   <div class="row">
      <a href="${url}" target="_blank"><div>${name}</div></a>
      
          
      <a href="edit-link.html?id=${name}" target="_blank" style="display: inline-block; width: 30px; height: 30px; overflow: hidden;">
  <?xml version="1.0" ?><!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 20010904//EN' 'http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd'>
  <svg height="30" preserveAspectRatio="xMidYMid meet" version="1.0" viewBox="0 0 256.000000 256.000000" width="30" xmlns="http://www.w3.org/2000/svg">
      <!-- Your SVG path here -->
      <g fill="#000000" stroke="none" transform="translate(0.000000,256.000000) scale(0.100000,-0.100000)">
          <path d="M2016 2465 c-22 -8 -53 -24 -70 -36 -35 -25 -175 -171 -345 -359 -320 -352 -690 -719 -1088 -1078 l-190 -170 -41 -105 c-66 -169 -203 -587 -200 -610 2 -13 11 -23 24 -25 21 -3 316 96 559 188 162 62 138 42 400 335 319 356 648 680 1090 1071 283 252 325 307 325 428 -1 68 -31 115 -156 237 -91 89 -128 119 -159 128 -53 14 -101 13 -149 -4z m117 -159 c46 -19 173 -154 181 -193 4 -17 2 -50 -4 -72 -12 -47 -56 -90 -420 -422 -390 -355 -503 -467 -1021 -1009 l-187 -195 -78 -29 c-44 -16 -84 -31 -91 -33 -6 -3 -14 6 -18 18 -11 32 -81 105 -116 119 -36 15 -35 23 12 135 28 67 38 79 251 280 351 332 706 689 954 960 331 362 392 423 439 440 51 18 59 18 98 1z"/>
      </g>
  </svg>
</a>
          </div>`;
          
          linksList.insertBefore(listItem, linksList.firstChild);

                
                });
            });
        } else {
            console.error("User not logged in");
            // Handle the case where the user is not logged in
        }
    });
}

// Call the function to display links when the page loads
document.addEventListener("DOMContentLoaded", displayLinks);