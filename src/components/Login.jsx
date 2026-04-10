import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { supabase } from '../lib/supabase';
import { Lock, LogIn, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AlmaFuelLogo from './AlmaFuelLogo';

// Animations
const float = keyframes`
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
  100% { transform: translateY(0px) scale(1); }
`;

const floatReverse = keyframes`
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(30px) scale(0.95); }
  100% { transform: translateY(0px) scale(1); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const floatUpEmber = keyframes`
  0% {
    transform: translateY(100vh) translateX(0) scale(0) rotate(0deg);
    opacity: 0;
  }
  20% {
    opacity: 0.8;
    transform: translateY(80vh) translateX(-20px) scale(1) rotate(45deg);
  }
  80% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(-20vh) translateX(20px) scale(0) rotate(360deg);
    opacity: 0;
  }
`;

const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  /* Deep background with a hot fiery base */
  background: radial-gradient(circle at 50% 120%, rgba(200, 50, 0, 0.4) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(6, 11, 20, 1) 100%);
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 1000;
`;

// Subtle noise texture overlay for absolute premium feel
const NoiseOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.03;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
`;

// Dynamic Vector Background Orbs
const VectorOrbBrand = styled.div`
  position: absolute;
  top: -10%;
  left: -5%;
  width: 50vw;
  height: 50vw;
  max-width: 800px;
  max-height: 800px;
  background: radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, transparent 65%);
  border-radius: 50%;
  filter: blur(80px);
  animation: ${float} 14s ease-in-out infinite;
  pointer-events: none;
`;

const VectorOrbBlue = styled.div`
  position: absolute;
  bottom: -15%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  max-width: 900px;
  max-height: 900px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 60%);
  border-radius: 50%;
  filter: blur(100px);
  animation: ${floatReverse} 18s ease-in-out infinite;
  pointer-events: none;
`;

const VectorOrbCenter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  height: 80vw;
  max-width: 600px;
  max-height: 600px;
  background: radial-gradient(circle, rgba(2ea043, 0.1) 0%, transparent 50%);
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
`;

const Ember = styled.div`
  position: absolute;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  background: ${(props) => props.$color};
  border-radius: 50%;
  filter: blur(${(props) => props.$blur}px);
  box-shadow: 0 0 ${(props) => props.$size * 2}px ${(props) => props.$color};
  left: ${(props) => props.$left}%;
  bottom: -10%;
  pointer-events: none;
  animation: ${floatUpEmber} ${(props) => props.$duration}s linear infinite;
  animation-delay: ${(props) => props.$delay}s;
  opacity: 0;
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 440px;
  padding: 3.5rem 3rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
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
    background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.6), rgba(56, 189, 248, 0.5), transparent);
    opacity: 0.7;
    border-radius: 24px 24px 0 0;
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
  filter: drop-shadow(0 0 25px rgba(249, 115, 22, 0.5));
`;

const Title = styled.h2`
  font-size: 2.2rem;
  font-weight: 900;
  margin: 0;
  font-family: 'Montserrat', sans-serif;
  color: var(--text-main);
  letter-spacing: -0.03em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  
  span.brand {
    color: var(--brand); /* Vibrant orange */
    text-shadow: 0 0 20px rgba(249, 115, 22, 0.4);
  }

  span.accent {
    color: var(--brand-blue);
    text-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
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
  left: 1.1rem;
  color: #64748b;
  display: flex;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 1rem 1rem 3.2rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  color: var(--text-main);
  font-family: 'Manrope', inherit;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  &:focus {
    border-color: rgba(249, 115, 22, 0.6);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.15);
    transform: translateY(-2px);
  }

  &:focus + ${IconWrapper}, &:focus-within ~ ${IconWrapper} {
    color: var(--brand); /* Icon glows orange when input focused */
    filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.5));
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  margin-top: 1rem;
  padding: 1.1rem;
  background: linear-gradient(135deg, var(--brand), #ea580c);
  color: #fff;
  border: none;
  border-radius: 16px;
  font-weight: 800;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 25px rgba(249, 115, 22, 0.4);
  letter-spacing: 0.04em;
  text-transform: uppercase;

  &:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 15px 35px rgba(249, 115, 22, 0.5);
    filter: saturate(1.2) brightness(1.1);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    box-shadow: none;
    cursor: not-allowed;
  }
`;

// Helper for generating embers
const EMBER_COLORS = ['#f97316', '#fbbf24', '#ef4444', '#38bdf8'];
function generateEmbers(count) {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    size: Math.random() * 6 + 2, // 2px to 8px
    left: Math.random() * 100, // 0 to 100%
    duration: Math.random() * 10 + 8, // 8s to 18s
    delay: Math.random() * 10, // 0s to 10s
    blur: Math.random() * 2 + 1, // 1px to 3px
    color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
  }));
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [embers, setEmbers] = useState([]);

  useEffect(() => {
    // Generate embers only on client side after mount to avoid hydration mismatches if SSR
    setEmbers(generateEmbers(25));
  }, []);

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
      {/* Deep Space Background Effects */}
      <VectorOrbBrand />
      <VectorOrbBlue />
      <VectorOrbCenter />
      <NoiseOverlay />

      {/* Floating Fire Embers */}
      {embers.map((ember) => (
        <Ember
          key={ember.id}
          $size={ember.size}
          $left={ember.left}
          $duration={ember.duration}
          $delay={ember.delay}
          $blur={ember.blur}
          $color={ember.color}
        />
      ))}

      {/* Core Interactive Card */}
      <LoginCard>
        <Header>
          <LogoWrapper>
            <AlmaFuelLogo size={72} />
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
