import React, { useState } from 'react'
import { data, useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard } from 'lucide-react';
import '../styles.css'


export default function MemberDashboard() {
    let status = "None";
    let name = "Vibhu Gangina";
    let member_class = "Tav";
    let due_date = "Nov 25, 2025"
    let amount_due = 180.00;

    const handleSquare = () => {
        window.open('https://squareup.com/us/en', '_blank');
    };


    return (
        <div className="min-h-screen w-full bg-gradient-to-r from-blue-200 to-cyan-200 p-15 absolute top-0 left-0">
            <div className="mx-auto rounded-xl bg-white drop-shadow-lg p-6 mb-5">
                <h1 className='font-bold text-2xl mb-2'>Welcome back, {name}!</h1>
                <p className="text-gray-500 dark:text-gray-400">Here's your membership overview</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-5">

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <CheckCircle size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>MEMBERSHIP CLASS</p>
                    </div>
                    <p className="font-bold text-2xl">{member_class}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <Calendar size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>NEXT DUE DATE</p>
                    </div>
                    <p className="font-bold text-2xl">{due_date}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <DollarSign size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>AMOUNT DUE</p>
                    </div>
                    <p className="font-bold text-2xl text-green-500">${amount_due}</p>
                </div>

            </div>

            <div className="rounded-xl bg-white drop-shadow-lg p-6 mb-5">

                <h1 className='font-bold text-2xl mb-2'>Make a Payment</h1>
                <p className="text-gray-500 text-base">
                    Keep your membership active by making secure payments through Square. All transactions are encrypted and protected.
                </p>

                <div className="flex mt-4 mb-1">
                    <button className="flex gap-2 mt-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-none rounded-lg cursor-pointer font-semibold text-base hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300" onClick={handleSquare}>
                        <CreditCard size={24} color="#ffffffff" />
                        Pay with Square
                    </button>
                </div>

            </div>

            <div className='mx-auto bg-white/20 rounded-xl p-6 text-center'>
                <p className='text-gray-500 text-base'>Questions? Contact Amaey Pandit via Slack!</p>
            </div>
        </div>
    );
}


