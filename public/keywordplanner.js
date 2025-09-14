document.getElementById('keywordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        developer_token: e.target.developer_token.value,
        mcc_id: e.target.mcc_id.value,
        customer_id: e.target.customer_id.value,
        keyword: e.target.keyword.value
    };

    const res = await fetch('/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });

    const data = await res.json();
    document.getElementById('keywordResult').textContent = JSON.stringify(data, null, 2);
});
