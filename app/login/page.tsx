'use client'
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Login() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            console.log(process.env.NEXT_PUBLIC_API_URL);
            // const response = await fetch('https://localhost:7151/api/Auth/authenticate', {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/Auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const token = await response.json();  // Use .text() instead of .json() for plain text responses
                console.log("Authentication Token:", token);
                localStorage.setItem('token', token.data.accessToken);
                router.push('/chat');
            } else {
                const errorText = await response.text(); // Assuming error details might also be in plain text
                throw new Error(errorText || 'Failed to authenticate');
            }
        } catch (error) {
            // `error` is of type `unknown` here, we need to type guard it
            if (error instanceof Error) {
                setError(error.message);  // Now `error.message` is safely accessible
            } else {
                setError('An unknown error occurred');
            }
            console.error("Authentication Error:", error);
        }
    };

    return (
        <div>
            <h1>Login</h1>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                />
                <button type="submit">Login</button>
            </form>
            {error && <p>{error}</p>}
        </div>
    );
}
