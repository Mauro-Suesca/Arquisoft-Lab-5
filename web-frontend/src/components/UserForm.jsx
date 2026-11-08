import { useState } from "react";

function UserForm({ onSearch, loading, disabled }) {

    const [name, setName] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();

        const username = name.trim();

        if (!username) {
            return;
        }

        onSearch(username);
    };

    return (
        <form onSubmit={handleSubmit} className="user-form">

            <label htmlFor="username">
                Username
            </label>

            <div className="input-group">

                <input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={disabled || loading}
                    required
                />

                <button
                    type="submit"
                    disabled={disabled || loading || !name.trim()}
                >
                    {loading ? "Loading..." : "Search"}
                </button>

            </div>

        </form>
    );
}

export default UserForm;