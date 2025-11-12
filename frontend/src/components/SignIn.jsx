import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg'
import './SignIn.css'


export default function SignIn() {
    const navigate = useNavigate();

    const handleSignIn = () => {
        navigate('/dashboard');
    };

    return (
        <div className="SignIn">
            <div className="right-side">
                <img src={logo} className="App-logo" alt="logo" />
                <div className="introductory-text">
                    <h1>TAMID DUES TRACKER!</h1>
                </div>
                <div className="input-boxes">
                    <input type="email" placeholder="email" />
                    <input type="password" placeholder="password" />
                    <button onClick={handleSignIn}>Sign in</button>
                </div>
            </div>

        </div>
    );
}
