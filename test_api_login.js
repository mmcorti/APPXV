async function testLoginRoute() {
    console.log("Testing POST /api/login...");
    try {
        const response = await fetch('http://localhost:3001/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@appxv.com',
                password: 'admin123'
            })
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));

        if (response.status === 200 && data.success) {
            console.log("TEST PASSED: Login successful.");
        } else {
            console.log("TEST FAILED: Login failed.");
        }

    } catch (error) {
        console.log("TEST ERROR:", error.message);
    }
}

testLoginRoute();
