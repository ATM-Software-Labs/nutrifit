const fs = require('fs');

async function check() {
    try {
        const res = await fetch('http://localhost:8788/api/config');
        console.log(res.status, await res.text());
    } catch (e) {
        console.error(e);
    }
}
check();
