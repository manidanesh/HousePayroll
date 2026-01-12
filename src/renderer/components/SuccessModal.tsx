import React from 'react';

interface SuccessModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, title, message, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay success-modal-overlay">
            <div className="modal-content success-modal-content">
                <div className="success-icon-container">
                    <div className="success-icon-circle">
                        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                        </svg>
                    </div>
                </div>
                <h3>{title}</h3>
                <div className="success-message-text">
                    {message.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>
                <button className="btn-primary" onClick={onClose}>Dismiss</button>
            </div>
        </div>
    );
};

export default SuccessModal;
