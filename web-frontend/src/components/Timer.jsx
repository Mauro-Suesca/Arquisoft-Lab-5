function Timer({ timeLeft }) {

    return (
        <div className="timer">

            <span className="timer-label">
                Time remaining
            </span>

            <span className="timer-value">
                {timeLeft.toFixed(1)}s
            </span>

        </div>
    );
}

export default Timer;