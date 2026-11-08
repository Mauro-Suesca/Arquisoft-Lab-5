import { useState, useEffect, useRef } from "react";

import UserForm from "../components/UserForm";
import CPSCounter from "../components/CPSCounter";
import Results from "../components/Results";

import {
    getUser,
    submitClicks
} from "../services/cpsService";

function Home() {

    const [user, setUser] = useState(null);

    const [clicks, setClicks] = useState(0);
    const [timeLeft, setTimeLeft] = useState(5);

    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    // References used by the timer
    const clicksRef = useRef(0);
    const deadlineRef = useRef(0);
    const finishedRef = useRef(false);

    // Search user in CPS Calculator
    const handleSearch = async (name) => {

        setIsLoading(true);
        setError("");
        setResult(null);
        setUser(null);

        try {

            const data = await getUser(name);

            setUser({
                name: data.Name,
                maxCPS: Number(data.maxCPS ?? 0)
            });

            setClicks(0);
            clicksRef.current = 0;
            setTimeLeft(5);

        } catch (err) {

            setError(
                "Unable to retrieve user information. Please try again."
            );

            console.error(err);

        } finally {

            setIsLoading(false);

        }
    };

    // Start a new CPS test
    const startTest = () => {

        if (!user || isRunning || isSubmitting) {
            return;
        }

        clicksRef.current = 0;
        finishedRef.current = false;

        setClicks(0);
        setTimeLeft(5);
        setResult(null);
        setError("");

        // Set the exact test deadline
        deadlineRef.current = Date.now() + 5000;

        setIsRunning(true);
    };

    // Register a click
    const registerClick = () => {

        if (!isRunning) {
            return;
        }

        clicksRef.current += 1;

        setClicks(clicksRef.current);

    };

    // Timer management and automatic result submission
    useEffect(() => {

        if (!isRunning) {
            return;
        }

        const interval = setInterval(async () => {

            const remaining = Math.max(
                0,
                (deadlineRef.current - Date.now()) / 1000
            );

            setTimeLeft(remaining);

            if (remaining <= 0 && !finishedRef.current) {

                finishedRef.current = true;

                clearInterval(interval);

                setIsRunning(false);
                setTimeLeft(0);
                setIsSubmitting(true);

                const totalClicks = clicksRef.current;

                try {

                    // Send clicks to CPS Calculator
                    const data = await submitClicks(
                        user.name,
                        totalClicks
                    );

                    // Process backend response
                    const currentCPS = Number(data.CPS);
                    const maximumCPS = Number(data.maxCPS);

                    setResult({
                        clicks: totalClicks,
                        cps: currentCPS,
                        maxCPS: maximumCPS
                    });

                    // Update user historical record
                    setUser(previous => ({
                        ...previous,
                        maxCPS: maximumCPS
                    }));

                } catch (err) {

                    setError(
                        "Unable to submit test results. Please try again."
                    );

                    console.error(err);

                } finally {

                    setIsSubmitting(false);

                }

            }

        }, 50);

        return () => clearInterval(interval);

    }, [isRunning, user]);

    return (

        <main className="home-container">

            <header className="header">

                <h1>CPS Calculator</h1>

                <p>
                    Test your clicking speed!
                </p>

            </header>

            <section className="main-panel">

                <UserForm
                    onSearch={handleSearch}
                    loading={isLoading}
                    disabled={isRunning || isSubmitting}
                />

                {error && (
                    <p className="error-message">
                        {error}
                    </p>
                )}

                {user && (

                    <>

                        <section className="user-info">

                            <h2>
                                Welcome, {user.name}
                            </h2>

                            <p>
                                Historical Record:
                                <strong>
                                    {" "}{user.maxCPS.toFixed(2)} CPS
                                </strong>
                            </p>

                        </section>

                        <CPSCounter
                            clicks={clicks}
                            timeLeft={timeLeft}
                            isRunning={isRunning}
                            onStart={startTest}
                            onClick={registerClick}
                        />

                        {isSubmitting && (
                            <p className="loading-message">
                                Submitting results...
                            </p>
                        )}

                        <Results result={result} />

                    </>

                )}

            </section>

            <footer className="footer">

                <p>
                    CPS Calculator - Clicks Per Second Test
                </p>

            </footer>

        </main>

    );
}

export default Home;