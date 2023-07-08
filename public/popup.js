// This code runs when the popup window is opened.

// When the popup is loaded, get a reference to the button element
// and add an event listener to it.
document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("close-popup");
    button.addEventListener("click", handleClick);
});

// This function is called when the button is clicked.
function handleClick() {
    // Do something when the button is clicked.
    alert("Button was clicked!");
}
