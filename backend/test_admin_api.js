const request = require('supertest');
const app = require('./src/app');

console.log('🔍 Test de l\'API /admin/users\n');

async function testAdminAPI() {
  try {
    // 1. Test de login
    console.log('🔐 Test de login...');
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@admin.com',
        password: 'VortexFlow2024!'
      });
    
    console.log('✅ Login Status:', loginResponse.status);
    console.log('👤 User:', loginResponse.body.user?.email);
    
    if (loginResponse.status !== 200) {
      console.error('❌ Login échoué:', loginResponse.body);
      return;
    }
    
    // Récupérer le cookie de session
    const cookies = loginResponse.headers['set-cookie'];
    console.log('🍪 Cookies reçus:', cookies?.[0]?.split(';')[0]);
    
    // 2. Test de l'API /admin/users
    console.log('\n📋 Test de l\'API /admin/users...');
    const usersResponse = await request(app)
      .get('/api/admin/users')
      .set('Cookie', cookies);
    
    console.log('✅ Users API Status:', usersResponse.status);
    console.log('📊 Response Body:', JSON.stringify(usersResponse.body, null, 2));
    
    if (usersResponse.body.data && usersResponse.body.data.users) {
      console.log('\n👥 Utilisateurs trouvés:', usersResponse.body.data.users.length);
      usersResponse.body.data.users.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - Stats: ${user.stats?.totalGraphs || 0} graphiques, ${user.stats?.totalSimulations || 0} simulations`);
      });
    } else {
      console.log('❌ Aucun utilisateur trouvé ou structure incorrecte');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testAdminAPI();
