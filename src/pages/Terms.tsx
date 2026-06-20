import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-green-500/30 selection:text-green-500 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-invert prose-slate max-w-none"
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Touchline Hub Terms and Conditions</h1>
          <p className="text-slate-400 text-sm mb-12">Last Updated: June 2026</p>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">1. Introduction</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Welcome to Touchline Hub ("we", "our", "us").
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                Touchline Hub is a football coaching and team management platform designed to help grassroots football coaches manage teams, players, fixtures, attendance, and matchday activities.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                By creating an account or using Touchline Hub, you agree to these Terms and Conditions.
              </p>
              <p className="text-slate-300 leading-relaxed">
                If you do not agree with these Terms, please do not use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">2. Eligibility</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                You must be at least 18 years old to create and manage a Touchline Hub account.
              </p>
              <p className="text-slate-300 leading-relaxed">
                If you are creating an account on behalf of a football team, club, or organisation, you confirm that you have the authority to do so.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">3. Account Registration</h2>
              <p className="text-slate-300 leading-relaxed mb-4">You may register using:</p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4 ml-4">
                <li>Email and password</li>
                <li>Google Sign-In</li>
              </ul>
              <p className="text-slate-300 leading-relaxed mb-4">
                When registering through Google, certain information may be provided by Google, including your name and email address.
              </p>
              <p className="text-slate-300 leading-relaxed">
                You are responsible for maintaining the security of your account and password.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">4. Data Collection</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Touchline Hub collects and stores information necessary to operate the platform, including:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4 ml-4">
                <li>Name</li>
                <li>Email address</li>
                <li>Team information</li>
                <li>Player information entered by coaches</li>
                <li>Usage and account information</li>
              </ul>
              <p className="text-slate-300 leading-relaxed mb-4">
                Payment information is not stored by Touchline Hub.
              </p>
              <p className="text-slate-300 leading-relaxed">
                All payments are securely processed by Stripe and are subject to Stripe's own terms and privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">5. Free Trial</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                New teams may be eligible for a free trial period of up to three (3) months.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                The free trial period begins on the date the team account is created.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                At the end of the trial period, continued access to certain features may require an active subscription.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Touchline Hub reserves the right to modify or withdraw free trial offers at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">6. Subscription Plans</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Touchline Hub currently offers:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4 ml-4">
                <li>Coach Pass Subscription</li>
                <li>£14.99 per month</li>
              </ul>
              <p className="text-slate-300 leading-relaxed mb-4">
                Subscriptions are billed through Stripe.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                By purchasing a subscription, you authorise recurring monthly payments until cancelled.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Prices may change in the future, but any changes will be communicated in advance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">7. Cancellation</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                You may cancel your subscription at any time.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">Upon cancellation:</p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4 ml-4">
                <li>No future subscription payments will be taken.</li>
                <li>Access to paid features may be restricted at the end of the current billing period.</li>
                <li>Certain read-only access may remain available.</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                No long-term contracts apply.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">8. Refund Policy</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                As Touchline Hub provides immediate access to digital services, subscription payments are generally non-refundable.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Refund requests may be considered on a case-by-case basis where required by law or where exceptional circumstances apply.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">9. Team and Player Data</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                You are responsible for ensuring that any information you enter into Touchline Hub is accurate and that you have the right to store and manage that information.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Where player information relates to children or minors, you are responsible for obtaining any permissions required by your club, league, organisation, or applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">10. Acceptable Use</h2>
              <p className="text-slate-300 leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4 ml-4">
                <li>Use the platform for unlawful purposes</li>
                <li>Attempt to gain unauthorised access to systems or data</li>
                <li>Upload malicious software or code</li>
                <li>Interfere with the operation of the platform</li>
                <li>Share access credentials with unauthorised users</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                We reserve the right to suspend or terminate accounts that breach these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">11. Availability</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                We aim to provide a reliable service but do not guarantee uninterrupted availability.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Maintenance, updates, outages, and technical issues may occasionally affect access.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">12. Limitation of Liability</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Touchline Hub is provided on an "as-is" basis.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                To the fullest extent permitted by law, we shall not be liable for:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4 ml-4">
                <li>Loss of data</li>
                <li>Loss of revenue</li>
                <li>Business interruption</li>
                <li>Indirect or consequential damages</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                Our total liability shall not exceed the amount paid by the customer during the preceding twelve months.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">13. Intellectual Property</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                All software, branding, logos, designs, and content relating to Touchline Hub remain the property of Touchline Hub unless otherwise stated.
              </p>
              <p className="text-slate-300 leading-relaxed">
                You may not copy, modify, distribute, or reproduce any part of the platform without permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">14. Changes to These Terms</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                We may update these Terms from time to time.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                Updated versions will be published within the platform or on our website.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Continued use of Touchline Hub after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-green-500">15. Contact</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                For questions regarding these Terms and Conditions, please contact:
              </p>
              <p className="text-slate-300 leading-relaxed">
                <a href="mailto:support@touchlinehub.com" className="text-blue-400 hover:underline">support@touchlinehub.com</a>
                <br />
                or
                <br />
                <a href="https://touchlinehub.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">https://touchlinehub.com</a>
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
