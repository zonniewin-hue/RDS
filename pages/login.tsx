import React from "react";
import { ShieldCheck } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import styles from "./login.module.css";

export default function Login() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.mark}>EA</div>
        <div className={styles.eyebrow}>CONFIDENTIAL PERSONNEL SYSTEM</div>
        <h1>Employee Attendance</h1>
        <p className={styles.intro}>Sign in to manage attendance records for your team.</p>
        <PasswordLoginForm />
        <div className={styles.secure}><ShieldCheck size={15}/> Secure manager access</div>
      </section>
    </main>
  );
}
