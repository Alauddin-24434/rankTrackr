document.getElementById('scForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const siteUrl = e.target.siteUrl.value;
    const resultBox = document.getElementById('scResult');
    resultBox.textContent = 'Loading...';

    try {
        const res = await fetch('/searchconsole', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl })
        });
        const data = await res.json();

        if (res.ok) {
            resultBox.textContent = JSON.stringify(data.data, null, 2);
        } else {
        
            resultBox.textContent = `Error (${data.status}): ${data.message}`;
        }
    } catch (err) {
        resultBox.textContent = 'Network error: ' + err.message;
    }
});