import React, { useState } from 'react';
import styled from 'styled-components';
import { supabase } from '../lib/supabase';
import { Lock, LogIn, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';

const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: radial-gradient(circle at top left, #1e293b 0%, #0f172a 40%, #0a0f1d 100%);
  position: relative;
  overflow: hidden;
`;

const BackgroundParticles = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
`;

const Particle = styled.div`
  position: absolute;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: ${props => props.$color || 'rgba(56, 189, 248, 0.2)'};
  border-radius: 50%;
  top: ${props => props.$top}%;
  left: ${props => props.$left}%;
  filter: blur(${props => props.$blur}px);
  animation: float ${props => props.$duration}s ease-in-out infinite;
  animation-delay: ${props => props.$delay}s;
  opacity: 0.4;

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(${props => props.$tx}px, ${props => props.$ty}px) scale(1.1); }
    66% { transform: translate(${props => props.$tx * -0.5}px, ${props => props.$ty * 1.2}px) scale(0.9); }
  }
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 420px;
  padding: 3rem;
  background: var(--surface);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  animation: fadeIn 0.8s ease-out;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  font-family: 'Montserrat', sans-serif;
  background: linear-gradient(135deg, var(--brand), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.04em;
  
  span {
    -webkit-text-fill-color: var(--text-main);
    opacity: 0.9;
  }
`;

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 0.9rem;
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
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const IconWrapper = styled.div`
  position: absolute;
  left: 0.75rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.85rem 0.85rem 0.85rem 2.8rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-main);
  font-family: inherit;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.3s;

  &:focus {
    border-color: var(--brand);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: var(--shadow-glow);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  margin-top: 1.5rem;
  padding: 0.9rem;
  background: linear-gradient(135deg, var(--brand), var(--accent-secondary));
  color: #0c1220;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 800;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.25);

  &:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(56, 189, 248, 0.35);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
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
      
      toast.success('Welcome back!');
      if (onLogin) onLogin(data.user);
    } catch (error) {
      toast.error(error.message || 'Error signing in');
    } finally {
      setLoading(false);
    }
  };

  const particles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    size: Math.random() * 150 + 50,
    top: Math.random() * 100,
    left: Math.random() * 100,
    blur: Math.random() * 40 + 20,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * -20,
    tx: Math.random() * 100 - 50,
    ty: Math.random() * 100 - 50,
    color: i % 3 === 0 ? 'rgba(56, 189, 248, 0.15)' : i % 3 === 1 ? 'rgba(129, 140, 248, 0.1)' : 'rgba(14, 165, 233, 0.05)'
  }));

  return (
    <LoginContainer>
      <BackgroundParticles>
        {particles.map(p => (
          <Particle
            key={p.id}
            $size={p.size}
            $top={p.top}
            $left={p.left}
            $blur={p.blur}
            $duration={p.duration}
            $delay={p.delay}
            $tx={p.tx}
            $ty={p.ty}
            $color={p.color}
          />
        ))}
      </BackgroundParticles>
      <LoginCard style={{ zIndex: 1, position: 'relative' }}>
        <Header>
          <Title>Deb<span>ors</span></Title>
          <Subtitle>Sign in to access the dashboard</Subtitle>
        </Header>
        <Form onSubmit={handleLogin}>
          <FormGroup>
            <Label>Email Address</Label>
            <InputWrapper>
              <IconWrapper><Mail size={18} /></IconWrapper>
              <Input
                type="email"
                placeholder="you@company.com"
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
            {loading ? 'Signing in...' : <><LogIn size={18} /> Sign In</>}
          </SubmitButton>
        </Form>
      </LoginCard>
    </LoginContainer>
  );
}

export default Login;
