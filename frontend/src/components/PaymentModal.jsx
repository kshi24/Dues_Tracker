import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, Loader } from 'lucide-react';

export default function PaymentModal({ isOpen, onClose, memberId, memberName, amountDue }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [paymentLink, setPaymentLink] = useState(null);

    const createPaymentLink = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8000/api/payments/create-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    member_id: memberId
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setPaymentLink(data.payment_link_url);
                setSuccess(true);
                // Open payment link in new tab
                window.open(data.payment_link_url, '_blank');
            } else {
                setError(data.detail || data.message || 'Failed to create payment link');
            }
        } catch (err) {
            console.error('Error creating payment link:', err);
            setError('Connection error. Make sure the backend is running on http://localhost:8000');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition"
                >
                    <X size={24} />
                </button>

                {/* Success State */}
                {success && !error && (
                    <div className="text-center">
                        <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Link Created!</h2>
                        <p className="text-gray-600 mb-4">
                            Opening payment page for {memberName}...
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            If the page didn't open, click the button below to open it manually.
                        </p>
                        <button
                            onClick={() => paymentLink && window.open(paymentLink, '_blank')}
                            className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition mb-3"
                        >
                            Open Payment Page
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
                        >
                            Close
                        </button>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div>
                        <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Error</h2>
                        <p className="text-red-600 mb-6 text-center">{error}</p>
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
                        >
                            Close
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="text-center">
                        <Loader size={64} className="mx-auto text-blue-500 mb-4 animate-spin" />
                        <p className="text-gray-600">Creating payment link...</p>
                    </div>
                )}

                {/* Initial State */}
                {!isLoading && !success && !error && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Pay Your Dues</h2>
                        <p className="text-gray-600 mb-6">
                            Member: <strong>{memberName}</strong>
                            <br />
                            Amount: <strong className="text-green-600">${amountDue.toFixed(2)}</strong>
                        </p>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-800">
                                🔒 You will be redirected to a secure Square payment page where you can pay with your credit or debit card.
                            </p>
                        </div>

                        <button
                            onClick={createPaymentLink}
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition disabled:bg-gray-400 mb-3"
                        >
                            {isLoading ? 'Creating Link...' : 'Create Payment Link'}
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}