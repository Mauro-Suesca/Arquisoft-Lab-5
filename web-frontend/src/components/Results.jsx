function Results({ result }) {

    if (!result) {
        return null;
    }

    return (
        <section className="results-container">

            <h2>Test Results</h2>

            <div className="results-grid">

                <div className="result-card">
                    <span>Clicks</span>
                    <strong>{result.clicks}</strong>
                </div>

                <div className="result-card">
                    <span>Current CPS</span>
                    <strong>{Number(result.cps).toFixed(2)}</strong>
                </div>

                <div className="result-card">
                    <span>Maximum CPS</span>
                    <strong>{Number(result.maxCPS).toFixed(2)}</strong>
                </div>

            </div>

        </section>
    );
}

export default Results;