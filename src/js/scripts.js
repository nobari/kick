//
// Scripts
// 
window.addEventListener('DOMContentLoaded', event => {
    let hash = window.location.hash || window.location.search;
    if (hash?.length) {
        hash = hash.substring(1);
        if (Object.keys(portfolios).includes(hash)) {
            console.log("openning:", hash);
            const modal = document.body.querySelector(`#${hash}Modal`);
            if (modal) {
                const myModal = new bootstrap.Modal(modal)
                if (myModal) myModal.toggle();
            }
        }
    }
    document.querySelectorAll(".portfolio-modal").forEach(myModal => {
        myModal.addEventListener('show.bs.modal', function () {
            window.history.pushState('', '', '?' + myModal.getAttribute("data-name"));
        })
        myModal.addEventListener('hide.bs.modal', function () {
            window.history.pushState('', '', '/');
        })
    })
    // Navbar shrink function
    var navbarShrink = function () {

        const torch = document.body.querySelector("#torch");
        if (torch) {
            const maxTop = (torch.offsetTop + torch.clientHeight - document.scrollingElement.scrollTop) / (torch.offsetTop + torch.clientHeight);
            if (maxTop > 0) {
                // console.log("scroll:", maxTop, this.state);
                const num = Math.ceil((1 - maxTop) * 10);
                const newImg = `assets/img/header/${num > 9 ? 9 : num}.png`;
                torch.src = newImg;
            }
        }

        const navbarCollapsible = document.body.querySelector('#mainNav');
        if (navbarCollapsible) {
            if (window.scrollY === 0) {
                navbarCollapsible.classList.remove('navbar-shrink')
            } else {
                navbarCollapsible.classList.add('navbar-shrink')
            }
        }

    };

    // Shrink the navbar 
    navbarShrink();

    // Shrink the navbar when page is scrolled
    document.addEventListener('scroll', navbarShrink);

    // Activate Bootstrap scrollspy on the main nav element
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            offset: 72,
        });
    };

    // Collapse responsive navbar when toggler is visible
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

});

const apiUrl = "https://us-central1-mozhiweb.cloudfunctions.net/checkAccess";
async function checkAccess(e) {
    const form = e.parentElement;// document.querySelector(".password-form");
    console.log("checkAccess:", form.id);
    let query = [];
    let valid = true;
    form.querySelectorAll("input").forEach(i => {
        if (i.value?.length) {
            i.parentElement.querySelector(".invalid").setAttribute("hidden", true);
            query.push(`${i.id}=${i.value}`)
        } else {
            i.parentElement.querySelector(".invalid").removeAttribute("hidden");
            valid = false;
        }
    })
    console.log("checkAccess:submit:", query);
    if (valid) {
        query.unshift(`docId=${form.id}`);
        try {
            await fetch(`${apiUrl}/?${query.join("&")}`);
        } catch (e) {
            window.alert("invalid password");
        }
    }
    // form.querySelectorAll(".invalid").forEach(f => f.removeAttribute("hidden"));
}