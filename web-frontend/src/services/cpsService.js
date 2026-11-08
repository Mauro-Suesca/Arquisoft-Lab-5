const API_URL = import.meta.env.VITE_API_URL || "/api";

// GET /users/{name}
export async function getUser(name) {
    const response = await fetch(
        `${API_URL}/users/${encodeURIComponent(name)}`
    );

    if (!response.ok) {
        throw new Error(
            `Error retrieving user: HTTP ${response.status}`
        );
    }

    return await response.json();
}

// POST /users/{name}
export async function submitClicks(name, clicks) {
    const response = await fetch(
        `${API_URL}/users/${encodeURIComponent(name)}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                clicks: clicks
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Error submitting clicks: HTTP ${response.status}`
        );
    }

    return await response.json();
}