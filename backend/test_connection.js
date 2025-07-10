const sequelize = require('./src/config/database');
require('dotenv').config();

console.log('🔍 Test de connexion à la base de données VortexFlow\n');

// Affichage des paramètres de connexion (sans mot de passe)
console.log('📋 Paramètres de connexion:');
console.log(`- DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
console.log(`- DB_PORT: ${process.env.DB_PORT || '5432'}`);
console.log(`- DB_NAME: ${process.env.DB_NAME || 'vortexflow'}`);
console.log(`- DB_USER: ${process.env.DB_USER || 'vortexflow_user'}`);
console.log(`- DB_PASSWORD: ${process.env.DB_PASSWORD ? '[DÉFINI]' : '[NON DÉFINI]'}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '[DÉFINI]' : '[NON DÉFINI]'}\n`);

async function testConnection() {
  try {
    console.log('🔌 Test de connexion...');
    
    // Test de l'authentification
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie !');
    
    // Test d'une requête simple
    console.log('\n📊 Test de requête SQL...');
    const [results] = await sequelize.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';'
    );
    
    console.log('✅ Requête réussie !');
    console.log(`📋 Tables trouvées (${results.length}):`, results.map(r => r.table_name).join(', '));
    
    // Test de la table users
    console.log('\n👥 Test de la table users...');
    const [userResults] = await sequelize.query('SELECT COUNT(*) as total FROM users;');
    console.log(`✅ Table users accessible - ${userResults[0].total} utilisateur(s) trouvé(s)`);
    
    // Affichage des utilisateurs
    const [users] = await sequelize.query(
      'SELECT id, email, first_name, last_name, role, is_active FROM users LIMIT 5;'
    );
    
    console.log('\n👤 Utilisateurs dans la base:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role} - Actif: ${user.is_active}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('🔍 Détails:', error.original?.message || 'Pas de détails supplémentaires');
  } finally {
    await sequelize.close();
    console.log('\n🔒 Connexion fermée');
  }
}

testConnection();
