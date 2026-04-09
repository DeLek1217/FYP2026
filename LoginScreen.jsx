// src/components/LoginScreen.jsx
import React, { useState } from 'react';
import './LoginScreen.css';
import regubotLogo from './assets/regubotLogo.png'; 

function LoginScreen({ handleLogin, loginError, loginForm, setLoginForm }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-wrapper">
      <div className="login-glowing-card">
        
        <div className="logo-container">
          {/* wrap the logo in a circle*/}
          <div className="logo-circle">
            <img src={regubotLogo} alt="ReguBot Logo" className="regubot-logo" />
          </div>
          <h1 className="system-title">ReguBot</h1>
          <h2>Welcome Back!</h2>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input 
              type="text" 
              placeholder="Username" 
              value={loginForm.username} 
              onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
              required 
            />
          </div>

          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="********" 
              value={loginForm.password} 
              onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="password-toggle"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <button type="submit" className="login-button">LOGIN</button>
        </form>

        {loginError && <p className="login-error-text">{loginError}</p>}
      </div>
    </div>
  );
}

export default LoginScreen;