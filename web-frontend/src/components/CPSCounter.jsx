import Timer from "./Timer";

function CPSCounter({
    clicks,
    timeLeft,
    isRunning,
    onStart,
    onClick
}) {

    return (
        <section className="counter-container">

            <Timer timeLeft={timeLeft} />

            <div className="click-display">
                {clicks}
            </div>

            <p className="click-description">
                Total clicks
            </p>

            {!isRunning ? (

                <button
                    className="start-button"
                    onClick={onStart}
                >
                    Start Test
                </button>

            ) : (

                <button
                    className="click-button"
                    onClick={onClick}
                >
                    CLICK!
                </button>

            )}

            <p className="instruction">
                {isRunning
                    ? "Presiona tan rapido como puedas!"
                    : "Presiona Start para comenzar."}
            </p>

        </section>
    );
}

export default CPSCounter;