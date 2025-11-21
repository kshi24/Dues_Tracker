import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

export default function SquarePayment({ memberId, amount, memberName, onSuccess }) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [card, setCard] = useState(null);
    const [config, setConfig] = useState(null);

    useEffect(() => {
        initializeSquare();
    }, []);

    const initializeSquare = async () => {
        try {
            // Get Square config from backend
            const configResponse = await fetch('http://localhost:8000/api/payments/config');
            const configData = await configResponse.json();
            setConfig(configData);

            // Load Square Web SDK
            const { payments } = await import('@square/web-sdk');
            const paymentsInstance = payments(configData.application_id, configData.location_id);

            // Initialize card payment
            const cardInstance = await paymentsInstance.card();
            await cardInstance.attach('#card-container');
            setCard(cardInstance);
            setIsLoading(false);
        } catch (err) {
            console.error('Error initializing Square:', err);
            setError('Failed to load payment form. Please try again.');
            setIsLoading(false);
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Tokenize card information
            const result = await card.tokenize();
            
            if (result.status === 'OK') {
                // Send payment to backend
                const response = await fetch('http://localhost:8000/api/payments/process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        member_id: memberId,
                        source_id: result.token,
                        amount: amount
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    setSuccess(true);
                    if (onSuccess) {
                        onSuccess(data);
                    }
                } else {
                    setError(data.message || 'Payment failed. Please try again.');
                }
            } else {
                setError('Invalid card information. Please check and try again.');
            }
        } catch (err) {
            console.error('Payment error:', err);
            setError('Payment failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
                <p className="text-gray-600 mb-4">
                    Thank you, {memberName}! Your payment of ${amount.toFixed(2)} has been processed.
                </p>
                <p className="text-sm text-gray-500">
                    A receipt has been sent to your email.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
                <CreditCard size={32} className="text-blue-500" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Pay Dues</h2>
                    <p className="text-gray-600">Amount: ${amount.toFixed(2)}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            <form onSubmit={handlePayment}>
                {/* Square card input will be inserted here */}
                <div id="card-container" className="mb-6"></div>

                {isLoading && !error ? (
                    <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                        <p className="text-gray-600 mt-2">Loading payment form...</p>
                    </div>
                ) : (
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
                    </button>
                )}
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
                🔒 Secure payment powered by Square
            </p>
        </div>
    );
}