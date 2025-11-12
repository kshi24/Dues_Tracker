import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'


export default function AdminDashboard() {
    let status = "None"
    const handleVenmo = () => {
        window.open('https://venmo.com/', '_blank');
    };

    const handlePayPal = () => {
        window.open('https://www.paypal.com/', '_blank');
    };

    const handleStripe = () => {
        window.open('https://buy.stripe.com/', '_blank');
    };


    return (
        <div className="members-list">
            <h1>TAMID Members</h1>
            <div className="screen">
                <div className="introductory-text">
                    <h1>Admin Dashboard</h1>
                </div>
                <div className="payment-boxes">
                    <button onClick={handleVenmo}>Pay with Venmo</button>
                    <button onClick={handlePayPal}>Pay with Paypal</button>
                    <button onClick={handleStripe}>Pay with Stripe</button>
                </div>
            </div>

        </div>
    );
}
