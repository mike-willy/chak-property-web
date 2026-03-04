import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBuilding, FaUsers, FaChartLine, FaWrench, FaArrowRight, FaShieldAlt, FaAndroid, FaMobileAlt, FaComments, FaFileInvoiceDollar, FaChevronDown, FaQuoteLeft, FaGlobe } from 'react-icons/fa';
import '../styles/LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const [activeFaq, setActiveFaq] = useState(null);

    const toggleFaq = (index) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    return (
        <div className="landing-page">
            {/* Navigation Bar */}
            <nav className="landing-nav">
                <div className="nav-container">
                    <div className="nav-logo">
                        <FaBuilding className="logo-icon" />
                        <span>Jesma Investments</span>
                    </div>
                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How it Works</a>
                        <button
                            className="login-btn-outline"
                            onClick={() => navigate('/login')}
                        >
                            Admin Portal
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-container">
                    <div className="hero-content">
                        <h1 className="hero-title">
                            Modern Property Management for the Digital Age
                        </h1>
                        <p className="hero-subtitle">
                            The premier platform used by Jesma Investments to automate rent collection, manage properties, and track maintenance seamlessly.
                        </p>
                        <div className="hero-buttons">
                            <button
                                className="btn-primary"
                                onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                            >
                                Explore Features <FaArrowRight />
                            </button>
                            <a
                                className="btn-secondary"
                                href="/jesma-investments-app.apk"
                                download="jesma-investments-app.apk"
                                style={{ textDecoration: 'none' }}
                            >
                                <FaAndroid style={{ fontSize: '1.2rem', color: '#3DDC84' }} /> Download Client App
                            </a>
                        </div>
                        <div className="trust-badges">
                            <span><FaShieldAlt /> Enterprise-Grade Security</span>
                            <span><FaChartLine /> Real-time Analytics</span>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="dual-mockup">
                            {/* Web Admin Mockup */}
                            <div className="mockup-window web-mockup">
                                <div className="mockup-header">
                                    <div className="mockup-dots">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                                <div className="mockup-body">
                                    <div className="mockup-sidebar"></div>
                                    <div className="mockup-main">
                                        <div className="mockup-cards">
                                            <div className="m-card"></div>
                                            <div className="m-card"></div>
                                            <div className="m-card"></div>
                                        </div>
                                        <div className="mockup-chart"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Phone Mockup */}
                            <div className="mockup-phone">
                                <div className="phone-notch"></div>
                                <div className="phone-screen">
                                    <div className="phone-header">
                                        <FaBuilding className="phone-logo" />
                                    </div>
                                    <div className="phone-content">
                                        <div className="phone-card"></div>
                                        <div className="phone-card"></div>
                                        <div className="phone-card half"></div>
                                        <div className="phone-card half"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="hero-gradient-overlay"></div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="how-it-works-section">
                <div className="section-container">
                    <div className="section-header">
                        <h2>How Jesma Investments Works</h2>
                        <p>A simple, powerful workflow designed to streamline your property management lifecycle.</p>
                    </div>
                    <div className="steps-container">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <div className="step-icon">
                                <FaBuilding />
                            </div>
                            <h3>Onboard Properties</h3>
                            <p>Easily add your buildings, generate units, and invite landlords to the platform.</p>
                        </div>
                        <div className="step-arrow"><FaArrowRight /></div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <div className="step-icon">
                                <FaUsers />
                            </div>
                            <h3>Assign Tenants</h3>
                            <p>Review digital applications and assign tenants securely to their new homes.</p>
                        </div>
                        <div className="step-arrow"><FaArrowRight /></div>
                        <div className="step-card">
                            <div className="step-number">3</div>
                            <div className="step-icon">
                                <FaChartLine />
                            </div>
                            <h3>Automate Everything</h3>
                            <p>Track rent, handle maintenance tickets, and generate beautiful PDF reports automatically.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Comprehensive Feature Spotlight (Bento Box) */}
            <section id="features" className="bento-section">
                <div className="section-container">
                    <div className="section-header">
                        <h2>Everything you need, in one place</h2>
                        <p>Replace your fragmented tools with our unified, full-stack management platform.</p>
                    </div>

                    <div className="bento-grid">
                        <div className="bento-card bento-large bg-gradient-blue text-white">
                            <div className="bento-content">
                                <h3><FaFileInvoiceDollar /> Financial Analytics</h3>
                                <p>Real-time revenue tracking, projected income calculations, and automated rent collection logging. Never miss a payment again.</p>
                            </div>
                        </div>

                        <div className="bento-card bg-white">
                            <div className="bento-content text-dark">
                                <div className="bento-icon text-green"><FaUsers /></div>
                                <h3>Tenant Lifecycle</h3>
                                <p>Complete oversight of leases, strict rent statuses, and digital profiles.</p>
                            </div>
                        </div>

                        <div className="bento-card bg-white">
                            <div className="bento-content text-dark">
                                <div className="bento-icon text-orange"><FaWrench /></div>
                                <h3>Maintenance Hub</h3>
                                <p>Track vendor tickets and unit turnover times seamlessly via the cloud.</p>
                            </div>
                        </div>

                        <div className="bento-card bento-wide bg-dark text-white">
                            <div className="bento-content">
                                <div className="bento-header-flex">
                                    <h3><FaComments /> Direct Messaging</h3>
                                    <span className="badge-new">New</span>
                                </div>
                                <p>Bridge the gap between administration and clients. Built-in chat capabilities let you communicate instantly with landlords.</p>
                            </div>
                        </div>

                        <div className="bento-card bg-white">
                            <div className="bento-content text-dark">
                                <div className="bento-icon text-purple"><FaGlobe /></div>
                                <h3>Global Portfolios</h3>
                                <p>Filter by active, vacant, or maintenance statuses across all buildings instantly.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Accordion (FAQ Style) */}
            <section className="faq-section">
                <div className="section-container faq-container">
                    <div className="faq-text">
                        <h2>Why choose Jesma?</h2>
                        <p>We built this platform to handle scale without sacrificing security or simplicity.</p>
                    </div>
                    <div className="faq-accordion">
                        {[
                            { title: "Secure Cloud Storage", content: "Built on Google Firebase, your data is protected with enterprise-grade security and backed up in real-time." },
                            { title: "Granular Admin Control", content: "Assign specific roles to your staff. Super Admins restrict access to sensitive financial data from standard users." },
                            { title: "Automated PDF Reports", content: "Generate branded, exportable PDF reports for landlords and board meetings with a single click." }
                        ].map((faq, index) => (
                            <div className={`faq-item ${activeFaq === index ? 'active' : ''}`} key={index} onClick={() => toggleFaq(index)}>
                                <div className="faq-header">
                                    <h3>{faq.title}</h3>
                                    <FaChevronDown className="faq-icon" />
                                </div>
                                <div className="faq-body">
                                    <p>{faq.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>



            {/* Final Global CTA */}
            <section className="global-cta-section">
                <div className="global-cta-content">
                    <h2>Ready to scale your property portfolio?</h2>
                    <p>Start managing smarter today with Jesma Investments.</p>
                    <div className="cta-actions">
                        <a
                            className="btn-download-large"
                            href="/jesma-investments-app.apk"
                            download="jesma-investments-app.apk"
                        >
                            <FaAndroid /> Download the App
                        </a>
                        <button
                            className="btn-outline-light"
                            onClick={() => navigate('/login')}
                        >
                            <FaShieldAlt /> Admin Login
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <FaBuilding className="footer-logo" />
                        <span>Jesma Investments</span>
                        <p>© {new Date().getFullYear()} Jesma Investments. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
