import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { supabase } from '../lib/supabase';
import { Lock, LogIn, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AlmaFuelLogo from './AlmaFuelLogo';

// Animations
const float = keyframes`
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
  100% { transform: translateY(0px) scale(1); }
`;

const floatReverse = keyframes`
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(20px) scale(0.95); }
  100% { transform: translateY(0px) scale(1); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const glowActive = keyframes`
  0% { box-shadow: 0 0 10px rgba(249, 115, 22, 0.2); }
  50% { box-shadow: 0 0 20px rgba(249, 115, 22, 0.5); }
  100% { box-shadow: 0 0 10px rgba(249, 115, 22, 0.2); }
`;

const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  /* Use transparent to let the glorious index.css body flame background shine through, or add our own deep base */
  background: radial-gradient(circle at center, rgba(15, 23, 42, 0.8) 0%, rgba(6, 11, 20, 1) 100%);
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 1000;
`;

// Dynamic Vector Background Orbs
const VectorOrbBrand = styled.div`
  position: absolute;
  top: -10%;
  left: -5%;
  width: 50vw;
  height: 50vw;
  max-width: 600px;
  max-height: 600px;
  background: radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, transparent 60%);
  border-radius: 50%;
  filter: blur(60px);
  animation: ${float} 12s ease-in-out infinite;
  pointer-events: none;
`;

const VectorOrbBlue = styled.div`
  position: absolute;
  bottom: -15%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  max-width: 700px;
  max-height: 700px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 60%);
  border-radius: 50%;
  filter: blur(80px);
  animation: ${floatReverse} 15s ease-in-out infinite;
  pointer-events: none;
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 440px;
  padding: 3.5rem 3rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  animation: ${fadeIn} 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.5), transparent);
    opacity: 0.5;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const LogoWrapper = styled.div`
  margin-bottom: 1rem;
  animation: ${float} 6s ease-in-out infinite;
`;

const Title = styled.h2`
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
  font-family: 'Montserrat', sans-serif;
  color: var(--text-main);
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  
  span.brand {
    color: var(--brand); /* Vibrant orange */
  }

  span.accent {
    color: var(--brand-blue);
  }
`;

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-top: 0.5rem;
  font-weight: 500;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const Label = styled.label`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-left: 0.2rem;
  letter-spacing: 0.02em;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
`;

const IconWrapper = styled.div`
  position: absolute;
  left: 1rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  transition: color 0.3s ease;
  z-index: 2;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.95rem 1rem 0.95rem 3rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  color: var(--text-main);
  font-family: 'Manrope', inherit;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  &:focus {
    border-color: rgba(249, 115, 22, 0.6);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
    transform: translateY(-2px);
  }

  &:focus + ${IconWrapper}, &:focus-within ~ ${IconWrapper} {
    color: var(--brand); /* Icon glows orange when input focused */
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  margin-top: 1rem;
  padding: 1.1rem;
  background: linear-gradient(135deg, var(--brand), #ea580c);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-weight: 800;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 20px rgba(249, 115, 22, 0.3);
  letter-spacing: 0.03em;
  text-transform: uppercase;

  &:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 12px 25px rgba(249, 115, 22, 0.45);
    filter: brightness(1.1);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    box-shadow: none;
    cursor: not-allowed;
  }
`;

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Welcome back!', {
        icon: '👋',
        style: {
          background: '#0f172a',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      });
      if (onLogin) onLogin(data.user);
    } catch (error) {
      toast.error(error.message || 'Error signing in', {
        style: {
          background: '#0f172a',
          color: '#fff',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <VectorOrbBrand />
      <VectorOrbBlue />
      <LoginCard>
        <Header>
          <LogoWrapper>
            <AlmaFuelLogo size={64} />
          </LogoWrapper>
          <Title>
            DEBORS <span className="brand">ALMA</span><span className="accent">FUEL</span>
          </Title>
          <Subtitle>Welcome back, please sign in</Subtitle>
        </Header>
        <Form onSubmit={handleLogin}>
          <FormGroup>
            <Label>Email Address</Label>
            <InputWrapper>
              <IconWrapper><Mail size={18} /></IconWrapper>
              <Input
                type="email"
                placeholder="you@almafuel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </InputWrapper>
          </FormGroup>
          <FormGroup>
            <Label>Password</Label>
            <InputWrapper>
              <IconWrapper><Lock size={18} /></IconWrapper>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </InputWrapper>
          </FormGroup>
          <SubmitButton type="submit" disabled={loading}>
            {loading ? 'Authenticating...' : <><LogIn size={20} /> Access System</>}
          </SubmitButton>
        </Form>
      </LoginCard>
    </LoginContainer>
  );
}

export default Login;
