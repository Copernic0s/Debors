import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { supabase } from '../lib/supabase';
import { Lock, LogIn, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AlmaFuelLogo from './AlmaFuelLogo';

// Subtle floating animation for the logo
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// Subtle sparks floating up
const floatUpSpark = keyframes`
  0% {
    transform: translateY(100vh) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
    transform: translateY(80vh) scale(1);
  }
  90% {
    opacity: 0.2;
  }
  100% {
    transform: translateY(-10vh) scale(0);
    opacity: 0;
  }
`;

const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  /* Deep dark background so the flame logo is the sole bright focal point */
  background:
    radial-gradient(circle at 18% 18%, rgba(85, 214, 255, 0.18), transparent 26%),
    radial-gradient(circle at 82% 14%, rgba(255, 122, 26, 0.16), transparent 22%),
    linear-gradient(145deg, #04101d 0%, #09172a 42%, #132746 100%);
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 1000;
`;

// Subtle noise texture overlay
const NoiseOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.02;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
`;

const Spark = styled.div`
  position: absolute;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  background: ${(props) => props.$color};
  border-radius: 50%;
  filter: blur(${(props) => props.$blur}px);
  left: ${(props) => props.$left}%;
  bottom: -5%;
  pointer-events: none;
  animation: ${floatUpSpark} ${(props) => props.$duration}s ease-in infinite;
  animation-delay: ${(props) => props.$delay}s;
  opacity: 0;
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 460px;
  padding: 3.3rem;
  background: linear-gradient(180deg, rgba(13, 27, 49, 0.72), rgba(8, 18, 34, 0.78));
  border: 1px solid rgba(180, 223, 255, 0.14);
  border-radius: 28px;
  box-shadow: 0 32px 80px -32px rgba(0, 0, 0, 0.86), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  animation: ${fadeIn} 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

// Only the logo gets the intense glow and movement
const LogoWrapper = styled.div`
  margin-bottom: 1.5rem;
  animation: ${float} 6s ease-in-out infinite;
  filter: drop-shadow(0 0 40px rgba(255, 122, 26, 0.65));
`;

const Title = styled.h2`
  font-size: 2.15rem;
  font-weight: 800;
  margin: 0;
  font-family: 'Syne', sans-serif;
  color: var(--text-main);
  letter-spacing: -0.04em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  
  span.brand {
    color: var(--brand-amber);
    text-shadow: 0 0 18px rgba(255, 179, 71, 0.15);
  }
`;

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-top: 0.75rem;
  max-width: 280px;
  line-height: 1.5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(223, 247, 255, 0.72);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-left: 0.2rem;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const IconWrapper = styled.div`
  position: absolute;
  left: 1rem;
  color: #7f95b0;
  display: flex;
  align-items: center;
  transition: color 0.3s ease;
  z-index: 2;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.9rem 1rem 0.9rem 3rem;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(180, 223, 255, 0.12);
  border-radius: 16px;
  color: var(--text-main);
  font-family: inherit;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.3s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  &:focus {
    border-color: rgba(255, 179, 71, 0.4);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 0 0 4px rgba(255, 122, 26, 0.08);
  }

  &:focus + ${IconWrapper}, &:focus-within ~ ${IconWrapper} {
    color: var(--brand);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  margin-top: 1.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, var(--brand-amber), var(--brand), var(--brand-deep));
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  /* Reduced shadow so it's not overpowering */
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #ffc46b, #ff7a1a, #cb4200);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Helper for generating subtle sparks
const SPARK_COLORS = ['#f97316', '#ffffff', '#38bdf8'];
function generateSparks(count) {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    size: Math.random() * 3 + 1, // very small (1-4px)
    left: Math.random() * 100, // 0 to 100%
    duration: Math.random() * 8 + 6, // 6s to 14s
    delay: Math.random() * 5, // 0s to 5s
    blur: Math.random() * 1.5, // minimal blur
    color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
  }));
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sparks, setSparks] = useState([]);

  useEffect(() => {
    // Generate delicate sparks
    setSparks(generateSparks(15));
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

      toast.success('Welcome back!');
      if (onLogin) onLogin(data.user);
    } catch (error) {
      toast.error(error.message || 'Error signing in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <NoiseOverlay />

      {/* Subtle Sparks */}
      {sparks.map((spark) => (
        <Spark
          key={spark.id}
          $size={spark.size}
          $left={spark.left}
          $duration={spark.duration}
          $delay={spark.delay}
          $blur={spark.blur}
          $color={spark.color}
        />
      ))}

      <LoginCard>
        <Header>
          <LogoWrapper>
            <AlmaFuelLogo size={64} />
          </LogoWrapper>
          <Title>
            <span className="brand">ALMAFUEL</span>
          </Title>
          <Subtitle>Operational cockpit for collections, support tracking, and account follow-up.</Subtitle>
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
            {loading ? 'Authenticating...' : <><LogIn size={18} /> Access System</>}
          </SubmitButton>
        </Form>
      </LoginCard>
    </LoginContainer>
  );
}

export default Login;
