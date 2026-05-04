const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.setupTransporter();
  }

  setupTransporter() {
    const emailConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    // Check if email is configured
    if (!emailConfig.host || !emailConfig.auth.user || !emailConfig.auth.pass) {
      logger.warn('Email service not configured - email features will be disabled', {
        hasHost: !!emailConfig.host,
        hasUser: !!emailConfig.auth.user,
        hasPass: !!emailConfig.auth.pass
      });
      return;
    }

    try {
      this.transporter = nodemailer.createTransporter(emailConfig);
      this.isConfigured = true;
      
      // Verify connection
      this.transporter.verify((error, _success) => {
        if (error) {
          logger.error('Email service verification failed', { error: error.message });
          this.isConfigured = false;
        } else {
          logger.info('Email service configured successfully');
        }
      });
    } catch (error) {
      logger.error('Failed to setup email transporter', { error: error.message });
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(user) {
    if (!this.isConfigured) {
      logger.warn('Cannot send welcome email - service not configured');
      return false;
    }

    const mailOptions = {
      from: `"VortexFlow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Welcome to VortexFlow!',
      html: this.generateWelcomeTemplate(user)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Welcome email sent', {
        userId: user.id,
        email: user.email,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send welcome email', {
        userId: user.id,
        email: user.email,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    if (!this.isConfigured) {
      logger.warn('Cannot send password reset email - service not configured');
      return false;
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"VortexFlow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Password Reset Request - VortexFlow',
      html: this.generatePasswordResetTemplate(user, resetUrl)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Password reset email sent', {
        userId: user.id,
        email: user.email,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send password reset email', {
        userId: user.id,
        email: user.email,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Send graph sharing notification
   */
  async sendGraphShareNotification(sharedWithUser, sharingUser, graph, permissionLevel) {
    if (!this.isConfigured) {
      logger.warn('Cannot send graph share notification - service not configured');
      return false;
    }

    const graphUrl = `${process.env.FRONTEND_URL}/graphs/${graph.id}`;
    
    const mailOptions = {
      from: `"VortexFlow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: sharedWithUser.email,
      subject: `Graph Shared: ${graph.title} - VortexFlow`,
      html: this.generateGraphShareTemplate(sharedWithUser, sharingUser, graph, permissionLevel, graphUrl)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Graph share notification sent', {
        sharedWithUserId: sharedWithUser.id,
        sharingUserId: sharingUser.id,
        graphId: graph.id,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send graph share notification', {
        sharedWithUserId: sharedWithUser.id,
        sharingUserId: sharingUser.id,
        graphId: graph.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Send simulation completion notification
   */
  async sendSimulationCompletionEmail(user, session, results) {
    if (!this.isConfigured) {
      logger.warn('Cannot send simulation completion email - service not configured');
      return false;
    }

    const sessionUrl = `${process.env.FRONTEND_URL}/simulations/${session.id}`;
    
    const mailOptions = {
      from: `"VortexFlow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Simulation Complete: ${session.session_name} - VortexFlow`,
      html: this.generateSimulationCompleteTemplate(user, session, results, sessionUrl)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Simulation completion email sent', {
        userId: user.id,
        sessionId: session.id,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send simulation completion email', {
        userId: user.id,
        sessionId: session.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate welcome email template
   */
  generateWelcomeTemplate(user) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to VortexFlow</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; margin-top: 20px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌊 Welcome to VortexFlow!</h1>
        </div>
        <div class="content">
          <h2>Hello ${user.first_name || 'there'}!</h2>
          <p>Welcome to VortexFlow, the premier platform for 3D visualization and simulation of DOT graphs with data flow animations.</p>
          
          <h3>🚀 Get Started:</h3>
          <ul>
            <li>Create your first graph using our DOT editor</li>
            <li>Visualize it in stunning 3D</li>
            <li>Run data flow simulations</li>
            <li>Share your graphs with team members</li>
          </ul>
          
          <p>Your account role: <strong>${user.role}</strong></p>
          
          <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
          
          <p>If you have any questions, feel free to reach out to our support team.</p>
        </div>
        <div class="footer">
          <p>© 2024 VortexFlow. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate password reset email template
   */
  generatePasswordResetTemplate(user, resetUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset - VortexFlow</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; color: #666; margin-top: 20px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${user.first_name || user.email}!</h2>
          <p>We received a request to reset your password for your VortexFlow account.</p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
          </div>
          
          <p>To reset your password, click the button below:</p>
          
          <a href="${resetUrl}" class="button">Reset Password</a>
          
          <p>This link will expire in 1 hour for security reasons.</p>
          
          <p>If the button doesn't work, copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        </div>
        <div class="footer">
          <p>© 2024 VortexFlow. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate graph share notification template
   */
  generateGraphShareTemplate(sharedWithUser, sharingUser, graph, permissionLevel, graphUrl) {
    const permissionText = permissionLevel === 'edit' ? 'edit' : 'view';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Graph Shared - VortexFlow</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .graph-info { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745; }
        .footer { text-align: center; color: #666; margin-top: 20px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Graph Shared With You</h1>
        </div>
        <div class="content">
          <h2>Hello ${sharedWithUser.first_name || sharedWithUser.email}!</h2>
          <p><strong>${sharingUser.first_name || sharingUser.email}</strong> has shared a graph with you on VortexFlow.</p>
          
          <div class="graph-info">
            <h3>${graph.title}</h3>
            <p>${graph.description || 'No description provided.'}</p>
            <p><strong>Permission Level:</strong> ${permissionText}</p>
            <p><strong>Category:</strong> ${graph.category || 'Uncategorized'}</p>
          </div>
          
          <p>You can now ${permissionText} this graph and run simulations on it.</p>
          
          <a href="${graphUrl}" class="button">View Graph</a>
        </div>
        <div class="footer">
          <p>© 2024 VortexFlow. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate simulation completion template
   */
  generateSimulationCompleteTemplate(user, session, results, sessionUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Simulation Complete - VortexFlow</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #17a2b8; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .results { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #17a2b8; }
        .stats { display: flex; justify-content: space-between; margin: 10px 0; }
        .stat { text-align: center; }
        .footer { text-align: center; color: #666; margin-top: 20px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 Simulation Complete</h1>
        </div>
        <div class="content">
          <h2>Hello ${user.first_name || user.email}!</h2>
          <p>Your simulation <strong>"${session.session_name}"</strong> has completed successfully.</p>
          
          <div class="results">
            <h3>📈 Results Summary</h3>
            <div class="stats">
              <div class="stat">
                <strong>${Math.round(results.duration || 0)}s</strong><br>
                <small>Duration</small>
              </div>
              <div class="stat">
                <strong>${results.totalSteps || 0}</strong><br>
                <small>Steps</small>
              </div>
              <div class="stat">
                <strong>${results.finalParticleCount || 0}</strong><br>
                <small>Particles</small>
              </div>
            </div>
          </div>
          
          <p>You can view the detailed results and replay the simulation.</p>
          
          <a href="${sessionUrl}" class="button">View Results</a>
        </div>
        <div class="footer">
          <p>© 2024 VortexFlow. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    if (!this.isConfigured) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is working' };
    } catch (error) {
      return { 
        success: false, 
        message: `Email configuration error: ${error.message}` 
      };
    }
  }
}

module.exports = new EmailService();
